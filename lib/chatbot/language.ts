import type { Language } from "@prisma/client";

const ILOCANO_MARKERS = [
  "ania",
  "siasino",
  "sadino",
  "kasano",
  "dagiti",
  "ti ",
  "nga ",
  "ket ",
  "wenno",
  "mabalin",
  "masapul",
  "adda",
  "saludsod",
  "agapply",
  "isumiter",
  "babaen",
  "anya",
  "apay",
  "sino",
  "ada",
  "damag",
  "kwa",
  "manu",
  "ngy",
  "idjay",
  "ijay",
  "haan",
  "wen",
  "pagsubmit",
];

const FILIPINO_MARKERS = [
  "ano",
  "sino",
  "paano",
  "saan",
  "kailan",
  "pwede",
  "kailangan",
  "mga",
  "ang ",
  "ng ",
  "sa ",
  "po",
  "ba ",
  "yung",
  "ito",
  "iyon",
  "mag-",
  "nag-",
  "makakakuha",
  "mayroon",
  "wala",
  "paki",
];

export function detectLanguage(text: string): Language {
  const lower = text.toLowerCase();
  const ilocanoScore = ILOCANO_MARKERS.filter((marker) => lower.includes(marker)).length;
  const filipinoScore = FILIPINO_MARKERS.filter((marker) => lower.includes(marker)).length;

  if (ilocanoScore > filipinoScore && ilocanoScore >= 2) {
    return "ILOCANO";
  }

  if (filipinoScore >= 2) {
    return "FILIPINO";
  }

  return "ENGLISH";
}

export function detectLanguageName(text: string): "english" | "filipino" | "ilocano" {
  const language = detectLanguage(text);
  if (language === "FILIPINO") return "filipino";
  if (language === "ILOCANO") return "ilocano";
  return "english";
}

export function languageToInstruction(language: Language) {
  switch (language) {
    case "FILIPINO":
      return "Sumagot sa Filipino. Panatilihing malinaw at maigsi ang paliwanag.";
    case "ILOCANO":
      return "Sungbatan iti Ilocano. Panagbalin nga nalawag ken direkta.";
    default:
      return "Respond in English. Keep the answer clear and concise.";
  }
}
