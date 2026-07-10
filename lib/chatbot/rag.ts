import type { Language } from "@prisma/client";
import { generateAnswer, type GeminiMessage } from "@/lib/chatbot/gemini";
import { detectLanguage, languageToInstruction } from "@/lib/chatbot/language";
import { formatRetrievedContext, retrieveChunksWithCache } from "@/lib/chatbot/retrieval";
import { prisma } from "@/lib/prisma";

export async function runRagAnswer(params: {
  question: string;
  language: Language;
  history: GeminiMessage[];
}) {
  const detectedLanguageName = params.language === "FILIPINO" ? "filipino" : params.language === "ILOCANO" ? "ilocano" : "english";
  const chunks = await retrieveChunksWithCache({ query: params.question, topK: 10, minSimilarity: 0.4 });
  const context = formatRetrievedContext(chunks);

  if (chunks.length === 0) {
    return { response: getFallbackMessage(detectedLanguageName), chunksUsed: 0 };
  }

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

  function isEventListingQuery(q: string) {
    return (
      containsEventKeywords(q) &&
      /\b(list|listed|show|what|which|real time|realtime|currently|live|posted|ilista|lista|listaan|iparang|makita|kitain)\b/i.test(q)
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

  function localizeUpcomingEvents(events: any[], language: Language, topic?: string | null) {
    const lines = events.map((e: any) => {
      const date = e.eventDate ? new Date(e.eventDate).toISOString().split("T")[0] : "TBA";
      const remaining = Math.max(0, (e.maxSlots ?? 0) - (e.filledSlots ?? 0));
      return `- ${e.title} — ${date} @ ${e.venue}${e.maxSlots ? ` (${language === "FILIPINO" ? "natitirang slots" : language === "ILOCANO" ? "natengnga a slots" : "slots remaining"}: ${remaining})` : ""}`;
    });

    if (language === "FILIPINO") {
      const header = topic ? `Oo — may ${events.length} paparating na kaganapan tungkol sa ${topic}:` : `Oo — may ${events.length} paparating na kaganapan:`;
      return `${header}\n\n${lines.join("\n")}\n\nPumunta sa SKonnect portal para magrehistro.`;
    }

    if (language === "ILOCANO") {
      const header = topic ? `Wen — adda ${events.length} a sumaruno a pasamak maipanggep iti ${topic}:` : `Wen — adda ${events.length} a sumaruno a pasamak:`;
      return `${header}\n\n${lines.join("\n")}\n\nSumrek ka iti SKonnect portal tapno agparehistro.`;
    }

    const header = topic ? `There ${events.length === 1 ? "is" : "are"} ${events.length} upcoming event${events.length === 1 ? "" : "s"} about ${topic}:` : `There are currently ${events.length} upcoming event${events.length === 1 ? "" : "s"}:`;
    return `${header}\n\n${lines.join("\n")}\n\nVisit the SKonnect portal to register.`;
  }

  const earlyTopic = extractTopicKeyword(params.question);

  // Early: handle topic-specific sports queries like "ti kwa ngy, volleyball" or
  // "goodmorning idol ada ba ti event nga basketball" before falling back to the
  // generic RAG answer.
  if (earlyTopic) {
    try {
      const now = new Date();
      const events = await prisma.event.findMany({
        where: {
          eventDate: { gte: now },
          status: { in: ["UPCOMING", "REGISTRATION_OPEN"] },
          OR: [
            { title: { contains: earlyTopic, mode: "insensitive" } },
            { description: { contains: earlyTopic, mode: "insensitive" } },
          ],
        },
        orderBy: { eventDate: "asc" },
        take: 10,
      });

      if (events.length > 0) {
        const resp = localizeUpcomingEvents(events, params.language, earlyTopic);
        return { response: resp, chunksUsed: chunks.length };
      }

      return { response: localizeNoEvents(params.language, earlyTopic), chunksUsed: chunks.length };
    } catch (e) {
      console.warn("Topic lookup failed:", e);
    }
  }

  if (isEventListingQuery(params.question) || isUpcomingQuery(params.question)) {
    try {
      const now = new Date();
      const topic = extractTopicKeyword(params.question);
      const monthYear = parseMonthYear(params.question);
      const eventDateFilter = monthYear
        ? {
            gte: new Date(Date.UTC(monthYear.year, monthYear.month, 1, 0, 0, 0)),
            lt: new Date(Date.UTC(monthYear.year, monthYear.month + 1, 1, 0, 0, 0)),
          }
        : { gte: now };

      const events = await prisma.event.findMany({
        where: {
          eventDate: eventDateFilter,
          status: { in: ["UPCOMING", "REGISTRATION_OPEN"] },
          ...(topic
            ? {
                OR: [
                  { title: { contains: topic, mode: "insensitive" } },
                  { description: { contains: topic, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { eventDate: "asc" },
        take: 10,
      });

      if (events.length > 0) {
        if (isRegistrationQuery(params.question) || containsSlotKeywords(params.question)) {
          const openEvents = events.filter((e) => (e.maxSlots ?? 0) > (e.filledSlots ?? 0));
          if (openEvents.length > 0) {
            const lines = openEvents.map((e) => {
              const date = e.eventDate ? new Date(e.eventDate).toISOString().split("T")[0] : "TBA";
              const remaining = Math.max(0, (e.maxSlots ?? 0) - (e.filledSlots ?? 0));
              return { title: e.title, date, venue: e.venue, remaining };
            });
            const resp = localizeOpenEvents(lines, params.language);
            return { response: resp, chunksUsed: chunks.length };
          }
        }

        const resp = localizeUpcomingEvents(events, params.language, topic);
        return { response: resp, chunksUsed: chunks.length };
      }

      return { response: localizeNoEvents(params.language, topic ?? undefined), chunksUsed: chunks.length };
    } catch (e) {
      console.warn("Live upcoming lookup failed:", e);
      // continue to other fallbacks
    }
  }

  if (isRegistrationQuery(params.question)) {
    try {
      const now = new Date();
      const events = await prisma.event.findMany({
        where: {
          eventDate: { gte: now },
          status: { in: ["UPCOMING", "REGISTRATION_OPEN"] },
        },
        orderBy: { eventDate: "asc" },
        take: 10,
      });

      const openEvents = events.filter((e) => (e.maxSlots ?? 0) > (e.filledSlots ?? 0));

      if (openEvents.length > 0) {
        const lines = openEvents.map((e) => {
          const date = e.eventDate ? new Date(e.eventDate).toISOString().split("T")[0] : "TBA";
          const remaining = (e.maxSlots ?? 0) - (e.filledSlots ?? 0);
          return { title: e.title, date, venue: e.venue, remaining };
        });

        const resp = localizeOpenEvents(lines, params.language);
        return { response: resp, chunksUsed: chunks.length };
      }

      // No live open events found; fall back to RAG summary below.
    } catch (e) {
      console.warn("Live event lookup failed:", e);
      // continue to retrieval-based response
    }
  }

  // Quick local post-processing: if the query is event-related and the retrieved
  // context strongly indicates events, return a concise factual summary instead
  // of relying solely on the model.
  try {
    if (isEventRelatedQuery(params.question)) {
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
        };
      }
    }
  } catch (e) {
    // swallow and fall through to model generation
    console.warn("RAG post-processing failed:", e);
  }

  // Tuned instruction: prefer answering directly from retrieved context and avoid
  // generic portal-only redirection when context provides an answer.
  const response = await generateAnswer({
    systemInstruction: [
      "You are the AI assistant of SKonnect, the official youth services portal of SK Barangay Pico, La Trinidad, Benguet.",
      `The user's detected language is: ${detectedLanguageName}.`,
      "Detect the language of the user's message.",
      "ALWAYS respond in the EXACT SAME language the user used.",
      "- If the user wrote in Filipino/Tagalog → respond fully in Filipino/Tagalog.",
      "- If the user wrote in Ilocano → respond fully in Ilocano.",
      "- If the user wrote in English → respond in English.",
      "- NEVER mix languages in a single response.",
      "- NEVER default to English if the user did not write in English.",
      "Use ONLY the provided context chunks to answer. Do not make up information.",
      "If the context does not contain enough information, say so — but say it in the user's language.",
      "Keep responses concise, friendly, and helpful.",
    ].join(" "),
    context,
    history: params.history,
    question: params.question,
  });

  if (!response || /don't know|not enough information|insufficient information|cannot answer|i am not sure/i.test(response.toLowerCase())) {
    return {
      response: getFallbackMessage(detectedLanguageName),
      chunksUsed: chunks.length,
    };
  }

  return {
    response,
    chunksUsed: chunks.length,
  };
}

function getFallbackMessage(detectedLanguage: string) {
  if (detectedLanguage === "filipino" || detectedLanguage === "tagalog") {
    return "Paumanhin, wala akong sapat na impormasyon para masagot ang iyong tanong. Maaari kang mag-submit ng formal na inquiry sa SK officials sa pamamagitan ng inquiry form sa portal.";
  }
  if (detectedLanguage === "ilocano") {
    return "Dispensarennak, awan ti sapat nga impormasyon para masungbatan ti saludsodmo. Mabalinmo nga isumiter ti formal nga inquiry kadagiti SK officials babaen ti inquiry form iti portal.";
  }
  return "Sorry, I don't have enough information to answer that. You can submit a formal inquiry to the SK officials through the portal's inquiry form.";
}

function localizeOpenEvents(events: { title: string; date: string; venue: string; remaining: number }[], language: Language) {
  if (language === "FILIPINO") {
    const lines = events.map((e) => `- ${e.title} — ${e.date} @ ${e.venue}${e.remaining !== undefined ? ` (natitirang slots: ${e.remaining})` : ""}`);
    return `Oo — may ${events.length} paparating na kaganapan:\n\n${lines.join("\n")}\n\nPumunta sa SKonnect portal para magrehistro.`;
  }

  if (language === "ILOCANO") {
    const lines = events.map((e) => `- ${e.title} — ${e.date} @ ${e.venue}${e.remaining !== undefined ? ` (natengnga a slots: ${e.remaining})` : ""}`);
    return `Wen — adda ${events.length} a sumaruno a pasamak:\n\n${lines.join("\n")}\n\nSumrek ka iti SKonnect portal tapno agparehistro.`;
  }

  // default English
  const lines = events.map((e) => `- ${e.title} — ${e.date} @ ${e.venue}${e.remaining !== undefined ? ` (slots remaining: ${e.remaining})` : ""}`);
  return `There are currently ${events.length} upcoming event${events.length === 1 ? "" : "s"}:\n\n${lines.join("\n")}\n\nVisit the SKonnect portal to register.`;
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
