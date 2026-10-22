import type { Language } from "@prisma/client";

const ILOCANO_MARKERS = new Set([
  "ania", "siasino", "sinu", "sadino", "kasano", "dagiti", "ti", "nga", "ket",
  "wenno", "mabalin", "masapul", "adda", "saludsod", "agapply", "isumiter",
  "babaen", "apay", "manu", "mano", "maysa", "balay", "iti", "wen", "haan",
  "awan", "papanak", "alaen", "idjay", "ijay",
]);

const FILIPINO_MARKERS = new Set([
  "ano", "sino", "paano", "saan", "kailan", "pwede", "puwede", "kailangan",
  "mga", "ang", "ng", "sa", "po", "ba", "yung", "ito", "iyon", "mag-apply",
  "makakakuha", "mayroon", "wala", "paki", "ilan", "isang", "pamilya",
  "maaari", "puwedeng", "pwedeng",
]);

export function detectLanguage(text: string): Language {
  const words = text.toLowerCase().match(/[a-zñ]+(?:-[a-z]+)*/g) ?? [];
  const tokens = new Set(words);
  const ilocanoScore = [...ILOCANO_MARKERS].filter((marker) => tokens.has(marker)).length;
  const filipinoScore = [...FILIPINO_MARKERS].filter((marker) => tokens.has(marker)).length;

  if (
    ["siasino", "sinu", "dagiti", "wenno"].some((marker) => tokens.has(marker))
    && !tokens.has("sino")
  ) {
    return "ILOCANO";
  }

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
