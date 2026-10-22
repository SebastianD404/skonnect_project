import type { Language } from "@prisma/client";
import { generateAnswer, translateQueryToEnglish, type GeminiMessage } from "@/lib/chatbot/gemini";
import { formatRetrievedContext, retrieveChunksWithCache } from "@/lib/chatbot/retrieval";

function sourceLabelsForChunks(chunks: Awaited<ReturnType<typeof retrieveChunksWithCache>>) {
  const labels = new Set<string>();
  for (const chunk of chunks) {
    const sourceType = chunk.sourceType.toLowerCase();
    if (sourceType.includes("skeap")) labels.add("Official SKEAP Guidelines");
    else if (sourceType.includes("event")) labels.add("SK Event Information");
    else if (sourceType.includes("contact")) labels.add("Barangay Pico Contact Information");
    else labels.add("SKonnect Knowledge Base");
  }
  return [...labels];
}

export async function runRagAnswer(params: {
  question: string;
  language: Language;
  history: GeminiMessage[];
  liveSystemContext?: string;
}) {
  const detectedLanguageName = params.language === "FILIPINO" ? "filipino" : params.language === "ILOCANO" ? "ilocano" : "english";
  const [originalChunks, translatedQuery] = await Promise.all([
    retrieveChunksWithCache({ query: params.question, topK: 10, minSimilarity: 0.4 }),
    translateQueryToEnglish(params.question, params.language),
  ]);
  const retrievalQuestion = translatedQuery ?? params.question;
  const translatedChunks = translatedQuery && translatedQuery.toLowerCase() !== params.question.toLowerCase()
    ? await retrieveChunksWithCache({ query: translatedQuery, topK: 10, minSimilarity: 0.4 })
    : [];
  const chunks = [...new Map(
    [...originalChunks, ...translatedChunks].map((chunk) => [chunk.id, chunk])
  ).values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);
  const context = formatRetrievedContext(chunks);
  const sources = sourceLabelsForChunks(chunks);

  // Detect whether the user is explicitly asking about live/open registrations
  function containsEventKeywords(q: string) {
    return /\b(event|events|kaganapan|pasamak)\b/i.test(q);
  }

  function containsRegistrationKeywords(q: string) {
    return /\b(register|registration|sign up|open registration|register for an event)\b/i.test(q);
  }

  function containsSlotKeywords(q: string) {
    return /\b(open slot|open slots|slots remaining|slot available|slots available|slot|slots)\b/i.test(q);
  }

  function isRegistrationQuery(q: string) {
    return (
      containsRegistrationKeywords(q) ||
      (containsSlotKeywords(q) && containsEventKeywords(q))
    );
  }

  function isEventRelatedQuery(q: string) {
    return (
      isUpcomingQuery(q) ||
      isRegistrationQuery(q) ||
      containsEventKeywords(q)
    );
  }

  // helper: extract topic keywords (sports, etc.)
  function extractTopicKeyword(q: string) {
    const topics = [
      "basketball",
      "badminton",
      "volleyball",
      "football",
      "soccer",
      "taekwondo",
      "dance",
      "music",
    ];
    const lowered = q.toLowerCase();
    for (const t of topics) {
      if (new RegExp(`\\b${t}\\b`, "i").test(lowered)) return t;
    }
    return null;
  }

  function parseMonthYear(q: string) {
    const months: Record<string, number> = {
      january: 0,
      enero: 0,
      february: 1,
      pebrero: 1,
      march: 2,
      marzo: 2,
      april: 3,
      abril: 3,
      may: 4,
      mayo: 4,
      june: 5,
      hunyo: 5,
      july: 6,
      hulyo: 6,
      august: 7,
      agosto: 7,
      september: 8,
      setyembre: 8,
      october: 9,
      oktubre: 9,
      november: 10,
      nobyembre: 10,
      december: 11,
      disyembre: 11,
    };
    const lowered = q.toLowerCase();
    const monthName = Object.keys(months).find((month) => new RegExp(`\\b${month}\\b`, "i").test(lowered));
    if (!monthName) return null;
    const yearMatch = lowered.match(/\b(20\d{2}|19\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
    return { month: months[monthName], year };
  }

  // detect existence/yes-no queries across languages (e.g. "awan ti...", "wala", "mayroon", "is there")
  function isExistenceQuery(q: string) {
    return /\b(is there|are there|any upcoming|mayroon bang|mayroon ba|wala|awan|adda kadi|adda|ada ba|awan ti|may)\b/i.test(q);
  }

  // Detect whether the user is asking if there are upcoming events (temporal check)
  function isUpcomingQuery(q: string) {
    return /\b(upcoming|next event|next events|any upcoming|are there any upcoming|is there an upcoming|upcoming events|paparating|mayroon bang|mayroon ba|may|darating|adda kadi|adda|sumaruno|sumaruno a pasamak)\b/i.test(q);
  }

  function localizeNoEvents(language: Language, topic?: string | null) {
    if (topic) {
      if (language === "FILIPINO") return `Wala pa po tungkol sa ${topic}.`;
      if (language === "ILOCANO") return `Awan pay ma'am/sir iti ${topic}.`;
      return `There are no ${topic} events at the moment.`;
    }
    if (language === "FILIPINO") return `Wala pa po kaming paparating na kaganapan.`;
    if (language === "ILOCANO") return `Awan pay ti sumaruno a pasamak.`;
    return `There are currently no upcoming events listed on SKonnect.`;
  }

  // Quick local post-processing: if the query is event-related and the retrieved
  // context strongly indicates events, return a concise factual summary instead
  // of relying solely on the model.
  try {
    if (isEventRelatedQuery(retrievalQuestion)) {
      const eventChunks = chunks.filter((c) => String(c.sourceType).toLowerCase().includes("event"));
      const strongEventChunks = eventChunks.filter((c) => Number(c.similarity ?? 0) >= 0.55);

      if (strongEventChunks.length > 0) {
        const top = strongEventChunks.slice(0, 3);
        const bullets = top.map((c) => {
          const firstLine = c.content.split("\n")[0].trim();
          const preview = firstLine.length > 200 ? `${firstLine.slice(0, 197)}...` : firstLine;
          return preview;
        });

        const summary = localizeRagSummary(bullets, params.language);

        return {
          response: summary,
          chunksUsed: chunks.length,
          sources,
        };
      }
    }
  } catch (e) {
    // swallow and fall through to model generation
    console.warn("RAG post-processing failed:", e);
  }

  const fallbackByLanguage = {
    english: "I don't have the exact details for that right now, but you can submit a formal inquiry to the SK officials using our Portal Inquiry Form or visit the Barangay Pico Hall.",
    filipino: "Paumanhin, wala akong sapat na detalye ukol diyan sa ngayon. Maaari kang magpadala ng pormal na inquiry gamit ang Inquiry Form o bumisita sa Barangay Pico Hall.",
    ilocano: "Dispensarennak, awan ti eksakto a detalye maipanggep iti dayta ita. Mabalinmo nga isumiter ti pormal nga saludsod babaen ti Inquiry Form wenno mapan idiay Barangay Pico Hall.",
  } as const;

  const response = await generateAnswer({
    systemInstruction: [
      "You are the official AI Assistant for SKonnect, serving the Sangguniang Kabataan of Barangay Pico, La Trinidad, Benguet.",
      "Answer youth questions about SKEAP scholarships, requirements, events, and barangay services with a warm, respectful, clear tone.",
      `The user's detected language is: ${detectedLanguageName}.`,
      "Language and translation rules: Context may be in English. Understand or translate the user's question and relevant context as needed, but respond entirely in the exact language the user used: natural Ilocano for Ilocano, natural Filipino/Tagalog for Filipino, or clear English for English. Do not mix languages or copy errors in the user's wording.",
      "Authoritative SKEAP policy facts: applicants must be 15 to 30 years old and may apply at any grade or educational level regardless of current enrollment status or timing, provided they complete the documentary requirements. Do not state or imply that current enrollment is mandatory. Exactly one scholar may be approved per household/immediate family; physical requirements may be submitted at Barangay Pico Hall/SK Office; sitting or elected Barangay Pico SK officials are ineligible to apply for or receive SKEAP; inquiry response depends on official availability and is typically reviewed within one hour during office hours, but this is not a guaranteed response time.",
      "Mandatory output rules: Eligibility trigger — whenever a user asks who can apply, about grade or educational levels, qualifications, or requirements, explicitly state that applicants must be between 15 and 30 years old. In Filipino or Ilocano, state this age requirement naturally in the user's language. Never omit the age requirement when discussing who may apply for SKEAP.",
      "These policy facts are authoritative even when retrieval returns no context or older retrieved text conflicts with them. For other facts, use only the retrieved context and do not invent details.",
      "Requirement Location Rule: When the user asks where to get or find their requirements, you MUST list the specific location for EVERY individual requirement line-by-line. Never summarize all requirements as being available in one place or just on the SKEAP portal.",
      `Fallback rule: if the answer is not in the authoritative policy facts or retrieved context, reply politely in the user's language and direct them to the Barangay Pico Hall or Portal Inquiry Form. Use this fallback wording in the detected language: ${fallbackByLanguage[detectedLanguageName]}`,
      "Do NOT use technical jargon, computer language, or IT terminology. Never say words like 'in the system', 'database', 'records', 'query', 'application logic', or 'data'.",
      "Do not mention technical details or internal implementation. Keep conversations simple and human.",
      params.liveSystemContext ? params.liveSystemContext : "",
      "Answer the user's question immediately in the first sentence.",
      "Keep responses as short as possible: 1 to 3 sentences maximum for standard factual questions, unless the user explicitly asks for a detailed breakdown or step-by-step list.",
      "Do not end with closing remarks, pleasantries, or follow-up offers. Never say 'Let me know if you need anything else,' 'Feel free to ask if you have more questions,' 'Hope this helps,' or similar filler.",
      "Stop generating text immediately once the core question has been answered.",
      "Do not provide extra context, policies, or related information that the user did not explicitly ask for.",
      "Use the authoritative policy facts above and the provided context chunks to answer. Do not make up other information.",
      "If the user asks for the current count, use the current update above and ignore any conflicting figures from older context.",
    ].filter(Boolean).join(" "),
    context,
    history: params.history,
    question: params.question,
  });

  if (!response || /don't know|not enough information|insufficient information|cannot answer|i am not sure/i.test(response.toLowerCase())) {
    return {
      response: getFallbackMessage(detectedLanguageName),
      chunksUsed: chunks.length,
      sources: [],
    };
  }

  return {
    response,
    chunksUsed: chunks.length,
    sources,
  };
}

function getFallbackMessage(detectedLanguage: string) {
  if (detectedLanguage === "filipino" || detectedLanguage === "tagalog") {
    return "Paumanhin, wala akong eksaktong detalye tungkol diyan sa ngayon. Maaari kang magsumite ng pormal na inquiry sa mga opisyal ng SK gamit ang Inquiry Form o bumisita sa Barangay Pico Hall.";
  }
  if (detectedLanguage === "ilocano") {
    return "Dispensarennak, awan ti eksakto a detalye maipanggep iti dayta ita. Mabalinmo nga isumitir ti pormal nga saludsod babaen ti Inquiry Form wenno mapan idiay Barangay Pico Hall.";
  }
  return "I don't have the exact details for that right now, but you can submit a formal inquiry to the SK officials using our Portal Inquiry Form or visit the Barangay Pico Hall.";
}


function localizeRagSummary(bullets: string[], language: Language) {
  if (language === "FILIPINO") {
    const lines = bullets.map((b) => `- ${b}`);
    return `Oo — may impormasyon tungkol sa mga paparating na kaganapan sa SKonnect.\n\n${lines.join("\n")}\n\nPara sa buong detalye, bisitahin ang SKonnect portal o sabihin "ilista ang mga kaganapan".`;
  }

  if (language === "ILOCANO") {
    const lines = bullets.map((b) => `- ${b}`);
    return `Wen — adda impormasyon maipanggep iti sumaruno a pasamak idiay SKonnect.\n\n${lines.join("\n")}\n\nPara iti amin a detalye, sumaruno ka iti SKonnect portal wenno ibaga "lista dagiti pasamak".`;
  }

  const lines = bullets.map((b) => `- ${b}`);
  return `Yes — SKonnect contains upcoming event information.\n\n${lines.join("\n")}\n\nFor full details, visit the SKonnect portal or ask me to list events.`;
}
