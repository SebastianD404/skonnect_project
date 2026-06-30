type GeminiMessage = {
  role: "user" | "assistant";
  content: string;
};

export function getGeminiKey() {
  return process.env.GOOGLE_GEMINI_API_KEY || null;
}

function getGeminiAuthHeaders() {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is not configured.");
  }

  const headers: Record<string, string> = {};
  let query = "";

  const apiKeyValue = apiKey.trim();
  if (apiKeyValue.match(/^(Bearer|bearer)\s+/)) {
    headers.Authorization = apiKeyValue;
  } else {
    query = `?key=${encodeURIComponent(apiKeyValue)}`;
  }

  return { headers, query };
}

function generateFallbackAnswer(question: string) {
  const normalized = question.toLowerCase();

  if (normalized.includes("deadline") || normalized.includes("due date") || normalized.includes("due")) {
    return "Most deadlines are posted on the announcements page. If you need an exact deadline, check your program details under the Events or Announcements section, or ask your SK officer for the current submission cutoff.";
  }

  if (normalized.includes("scholarship") || normalized.includes("requirements") || normalized.includes("requirements")) {
    return "Scholarship requirements usually include a complete application form, proof of enrollment, and barangay residency documents. Visit the scholarship or programs page for the exact checklist or contact your barangay SK officer for the latest guidance.";
  }

  if (normalized.includes("submission") || normalized.includes("submit") || normalized.includes("upload")) {
    return "Upload your requirements through the submissions section of the dashboard. Make sure your files match the requested format and check for any return-for-edit notes from SK before resubmitting.";
  }

  if (normalized.includes("event") || normalized.includes("register")) {
    return "You can register for SKEAP events from the Events page. Look for active event cards and click Register to secure your slot. If you don’t see an event, refresh the page or contact SK support.";
  }

  return "The AI helpdesk is temporarily unavailable, but you can still use the dashboard navigation to view announcements, events, and submission requirements. If you need urgent support, please contact your SK officer directly.";
}

export async function embedText(text: string): Promise<number[]> {
  const modelName = "gemini-embedding-001";
  const auth = getGeminiAuthHeaders();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent${auth.query}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth.headers },
    body: JSON.stringify({
      model: `models/${modelName}`,
      content: {
        parts: [{ text }],
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini embedding failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    embedding?: {
      values?: number[];
    };
  };

  const values = data.embedding?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini embedding returned an empty vector.");
  }

  return values;
}

async function tryGenerateWithModel(params: {
  auth: ReturnType<typeof getGeminiAuthHeaders>;
  modelName: string;
  prompt: string;
}) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${params.modelName}:generateContent${params.auth.query}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...params.auth.headers },
    body: JSON.stringify({
      model: `models/${params.modelName}`,
      contents: [
        {
          role: "user",
          parts: [{ text: params.prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini generate failed for ${params.modelName}: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  if (!text) {
    throw new Error(`Gemini returned an empty response for ${params.modelName}.`);
  }

  return text;
}

export async function generateAnswer(params: {
  systemInstruction: string;
  context: string;
  history: GeminiMessage[];
  question: string;
}) {
  let auth;
  try {
    auth = getGeminiAuthHeaders();
  } catch {
    return generateFallbackAnswer(params.question);
  }

  const historyParts = params.history
    .slice(-10)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");

  const prompt = [
    params.systemInstruction,
    "",
    "Relevant retrieved context:",
    params.context || "(No relevant context found)",
    "",
    "Conversation history:",
    historyParts || "(No previous messages)",
    "",
    `User question: ${params.question}`,
    "",
    "Answer the user directly. If uncertain, say what is missing and suggest contacting SK support.",
  ].join("\n");

  const fallbackModels = [
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
    "gemini-flash-latest",
  ];

  for (const modelName of fallbackModels) {
    try {
      return await tryGenerateWithModel({ auth, modelName, prompt });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Gemini generate model fallback:", modelName, message);
      if (message.includes("Unknown name \"prompt\"") || message.includes("schema") || message.includes("not found")) {
        continue;
      }
      if (modelName === fallbackModels[fallbackModels.length - 1]) {
        console.error("All Gemini models failed to generate an answer.", message);
      }
    }
  }

  return generateFallbackAnswer(params.question);
}

export type { GeminiMessage };
