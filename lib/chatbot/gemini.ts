import type { Language } from "@prisma/client";
import { detectLanguage } from "@/lib/chatbot/language";

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
  const language = detectLanguage(question);

  if (language === "ILOCANO") {
    return "Dispensarennak, awan ti eksakto a detalye maipanggep iti dayta ita. Mabalinmo nga isumitir ti pormal nga saludsod kadagiti opisyal ti SK babaen ti Inquiry Form wenno mapan idiay Barangay Pico Hall.";
  }

  if (language === "FILIPINO") {
    return "Paumanhin, wala akong eksaktong detalye tungkol diyan sa ngayon. Maaari kang magsumite ng pormal na inquiry sa mga opisyal ng SK gamit ang Inquiry Form o bumisita sa Barangay Pico Hall.";
  }

  if (/\b(household|family|families|sibling|siblings|one per home)\b/.test(normalized)) {
    return "Only one scholar may be approved per household or immediate family.";
  }

  if (/\b(sitting|elected|sk official|sk officials|officials)\b/.test(normalized)
    && /\b(skeap|scholarship|apply|eligible|receive|grant)\b/.test(normalized)) {
    return "Sitting members and elected officials of the Sangguniang Kabataan of Barangay Pico are not eligible to apply for or receive SKEAP.";
  }

  if (/\b(physical|in person|in-person|paper|submit|submission|documents|requirements)\b/.test(normalized)
    && /\b(hall|office|submit|submission|physical|in person|in-person|paper)\b/.test(normalized)) {
    return "Yes. You may submit your SKEAP requirements in person at Barangay Pico Hall or the SK Office instead of uploading them online.";
  }

  if (/\b(response|reply|inquiry|inquiries|hear back)\b/.test(normalized)) {
    return "Response times depend on SK officials' availability. Inquiries are typically reviewed within one hour during office hours, but that timeframe is not guaranteed.";
  }

  if (/\b(age|eligible|eligibility|apply|applicant|grade level|enrollment)\b/.test(normalized)) {
    return "SKEAP is open to youth residents aged 15 to 30. Applicants may apply at any grade or educational level regardless of current enrollment status or timing, provided they submit the complete documentary requirements.";
  }

  return "I don't have the exact details for that right now, but you can submit a formal inquiry to the SK officials using our Portal Inquiry Form or visit the Barangay Pico Hall.";
}

export async function translateQueryToEnglish(question: string, language: Language): Promise<string | null> {
  if (language === "ENGLISH") return question;

  let auth: ReturnType<typeof getGeminiAuthHeaders>;
  try {
    auth = getGeminiAuthHeaders();
  } catch {
    return null;
  }

  const prompt = [
    "Translate the user's question into concise, natural English for searching a scholarship and barangay-services knowledge base.",
    "Return only the translated question. Do not answer it, add explanations, or change its meaning.",
    `Detected source language: ${language === "FILIPINO" ? "Filipino/Tagalog" : "Ilocano"}.`,
    `Question: ${question}`,
  ].join("\n");

  for (const modelName of ["gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-flash-latest"]) {
    try {
      const translated = await tryGenerateWithModel({ auth, modelName, prompt });
      return translated.replace(/^["'“”]+|["'“”]+$/g, "").trim() || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Gemini query translation model fallback:", modelName, message);
    }
  }

  return null;
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
