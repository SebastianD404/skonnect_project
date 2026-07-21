import * as chrono from "chrono-node";

export type BirthdateVerificationResult = {
  isValid: boolean;
  message: string;
  parsedDates?: string[]; // array of normalized YYYY-MM-DD strings found in OCR text
};

function normalizeToISODateString(date: Date) {
  // Normalize to UTC date portion YYYY-MM-DD
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseFormDate(mmddyyyy: string): string | null {
  if (!mmddyyyy) return null;
  const raw = String(mmddyyyy).trim();

  // Accept MM/DD/YYYY or YYYY-MM-DD or YYYY/MM/DD
  // Try MM/DD/YYYY first
  const slashParts = raw.split("/");
  if (slashParts.length === 3) {
    const a = Number(slashParts[0]);
    const b = Number(slashParts[1]);
    const c = Number(slashParts[2]);
    // Heuristic: if first part > 31, it's likely YYYY/MM/DD
    if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
      if (a > 31) {
        // YYYY/MM/DD
        const year = c === 0 ? a : a; // keep a as year
        const month = b;
        const day = c;
        const date = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isNaN(date.getTime())) return normalizeToISODateString(date);
      } else {
        // MM/DD/YYYY
        const month = a;
        const day = b;
        const year = c;
        const date = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isNaN(date.getTime())) return normalizeToISODateString(date);
      }
    }
  }

  // Try dash-separated YYYY-MM-DD or DD-MM-YYYY (ambiguous). Prefer ISO-like format.
  const dashParts = raw.split("-");
  if (dashParts.length === 3) {
    const a = Number(dashParts[0]);
    const b = Number(dashParts[1]);
    const c = Number(dashParts[2]);
    if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
      if (a > 31) {
        // YYYY-MM-DD
        const date = new Date(Date.UTC(a, b - 1, c));
        if (!Number.isNaN(date.getTime())) return normalizeToISODateString(date);
      } else {
        // MM-DD-YYYY
        const date = new Date(Date.UTC(c, a - 1, b));
        if (!Number.isNaN(date.getTime())) return normalizeToISODateString(date);
      }
    }
  }

  // Fallback: try Date parsing via JS (not ideal but a last resort)
  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) return normalizeToISODateString(fallback);

  return null;
}

function parseDateStringFlexible(raw: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();

  // Normalize common separators to '/'
  const normalized = s.replace(/\./g, "/").replace(/-/g, "/").replace(/\\s+/g, "");

  // Match patterns like MM/DD/YYYY or M/D/YY or YYYY/MM/DD
  const m = normalized.match(/(\d{1,4})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let a = Number(m[1]);
    const b = Number(m[2]);
    let c = Number(m[3]);

    if (a > 31) {
      // a is year: YYYY/MM/DD
      const year = a;
      const month = b;
      const day = c;
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(date.getTime())) return normalizeToISODateString(date);
    } else if (c > 31) {
      // a/b/YYYY -> MM/DD/YYYY
      const month = a;
      const day = b;
      const year = c;
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(date.getTime())) return normalizeToISODateString(date);
    } else {
      // ambiguous year length
      // treat c as year; if two digits, map to 1900/2000
      if (String(c).length === 2) {
        const two = c;
        const now = new Date();
        const thisYearTwo = Number(String(now.getUTCFullYear()).slice(-2));
        const century = two <= thisYearTwo ? 2000 : 1900;
        const year = century + two;
        const month = a;
        const day = b;
        const date = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isNaN(date.getTime())) return normalizeToISODateString(date);
      } else {
        const year = c;
        const month = a;
        const day = b;
        const date = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isNaN(date.getTime())) return normalizeToISODateString(date);
      }
    }
  }

  return null;
}

/**
 * Verify that a birthdate extracted from the OCR text on the back of an ID
 * matches the provided profile birthDate (in MM/DD/YYYY format).
 *
 * - Uses `chrono-node` to extract natural language dates from the OCR text.
 * - Normalizes dates to `YYYY-MM-DD` for strict comparison.
 *
 * Returns an object { isValid, message, parsedDates }.
 */
export function verifyBackIdBirthdate(ocrText: string, profileBirthDateMmDdYyyy: string): BirthdateVerificationResult {
  const normalizedProfile = parseFormDate(profileBirthDateMmDdYyyy);
  if (!normalizedProfile) {
    return {
      isValid: false,
      message: "Verification Failed: Invalid profile birth date format.",
    };
  }

  if (!ocrText || !String(ocrText).trim()) {
    return {
      isValid: false,
      message: "Verification failed: Mismatched birthdate or unclear image.",
      parsedDates: [],
    };
  }

  // First, try to pick up explicit numeric date patterns via regex (fast, reliable)
  // Keywords that, if near a parsed date, increase confidence that the date is a DOB
  const DOB_KEYWORDS = ["birth", "born", "date of birth", "dob", "bday", "birthdate", "dateofbirth", "bd"];
  const parsedCandidates: { iso: string; text: string; index: number }[] = [];
  const numericDateRegex = /(\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g;
  const lowerOcr = String(ocrText || "");
  let m: RegExpExecArray | null;
  while ((m = numericDateRegex.exec(lowerOcr))) {
    const rawMatch = m[1];
    const iso = parseDateStringFlexible(rawMatch) || parseFormDate(rawMatch);
    if (iso) {
      parsedCandidates.push({ iso, text: rawMatch, index: m.index });
    }
  }

  // Then use chrono-node to find additional natural-language dates and merge
  try {
    const results = chrono.parse(String(ocrText));
    for (const r of results) {
      try {
        const dt = r.date();
        if (dt && !Number.isNaN(dt.getTime())) {
          const iso = normalizeToISODateString(dt);
          const matchedText = (r.text || "").toString();
          const idx = typeof r.index === "number" ? r.index : String(ocrText).indexOf(matchedText);
          // avoid duplicates
          if (!parsedCandidates.find((c) => c.iso === iso && c.index === idx)) {
            parsedCandidates.push({ iso, text: matchedText, index: idx });
          }
        }
      } catch (e) {
        // ignore individual parse failures
      }
    }
  } catch (e) {
    // chrono failure shouldn't crash verification
  }

  // Also pick up compact numeric forms like 10142003 or 101403 (MMDDYY)
  try {
    const compact8 = /\b(\d{8})\b/g;
    let mm: RegExpExecArray | null;
    while ((mm = compact8.exec(lowerOcr))) {
      const raw = mm[1];
      const month = Number(raw.slice(0, 2));
      const day = Number(raw.slice(2, 4));
      const year = Number(raw.slice(4, 8));
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(d.getTime())) {
        const iso = normalizeToISODateString(d);
        if (!parsedCandidates.find((c) => c.iso === iso && c.index === mm!.index)) {
          parsedCandidates.push({ iso, text: raw, index: mm!.index });
        }
      }
    }

    const compact6 = /\b(\d{6})\b/g; // MMDDYY
    while ((mm = compact6.exec(lowerOcr))) {
      const raw = mm[1];
      const month = Number(raw.slice(0, 2));
      const day = Number(raw.slice(2, 4));
      let year = Number(raw.slice(4, 6));
      const now = new Date();
      const thisYearTwo = Number(String(now.getUTCFullYear()).slice(-2));
      const century = year <= thisYearTwo ? 2000 : 1900;
      year = century + year;
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(d.getTime())) {
        const iso = normalizeToISODateString(d);
        if (!parsedCandidates.find((c) => c.iso === iso && c.index === mm!.index)) {
          parsedCandidates.push({ iso, text: raw, index: mm!.index });
        }
      }
    }

    // Space-separated numeric dates like '10 14 2003'
    const spaced = /\b(\d{1,2})\s+(\d{1,2})\s+(\d{2,4})\b/g;
    let ms: RegExpExecArray | null;
    while ((ms = spaced.exec(lowerOcr))) {
      const a = Number(ms[1]);
      const b = Number(ms[2]);
      let c = Number(ms[3]);
      if (String(c).length === 2) {
        const now = new Date();
        const thisYearTwo = Number(String(now.getUTCFullYear()).slice(-2));
        const century = c <= thisYearTwo ? 2000 : 1900;
        c = century + c;
      }
      const d = new Date(Date.UTC(c, a - 1, b));
      if (!Number.isNaN(d.getTime())) {
        const iso = normalizeToISODateString(d);
        if (!parsedCandidates.find((c2) => c2.iso === iso && c2.index === ms!.index)) {
          parsedCandidates.push({ iso, text: ms![0], index: ms!.index });
        }
      }
    }
  } catch (e) {
    // non-fatal
  }

  const allParsedDates = Array.from(new Set(parsedCandidates.map((c) => c.iso)));

  // Filter out implausible dates: exclude future years and very old years
  const currentYear = new Date().getUTCFullYear();
  const minYear = 1900;
  const maxYear = currentYear - 5; // assume people are at least 5 years old

  const plausibleDates = allParsedDates.filter((iso) => {
    const y = Number(iso.slice(0, 4));
    return !Number.isNaN(y) && y >= minYear && y <= maxYear;
  });

  // For display / return, prefer plausible dates if any were found; otherwise return all parsed dates
  const parsedDates = plausibleDates.length > 0 ? plausibleDates : allParsedDates;

  // If no dates found, fail
  if (parsedCandidates.length === 0) {
    return {
      isValid: false,
      message: "Verification failed: Mismatched birthdate or unclear image.",
      parsedDates: [],
    };
  }

  // First, check for an exact ISO match
  if (parsedDates.includes(normalizedProfile)) {
    return {
      isValid: true,
      message: "Birthdate verified.",
      parsedDates,
    };
  }

  // If not an exact match, check whether any parsed candidate appears near DOB keywords
  const lowerText = String(ocrText).toLowerCase();
  const proximityWindow = 40; // chars before/after the parsed text to search for keywords

  for (const candidate of parsedCandidates) {
    const start = Math.max(0, candidate.index - proximityWindow);
    const context = lowerText.substring(start, candidate.index + candidate.text.length + proximityWindow);
    for (const kw of DOB_KEYWORDS) {
      if (context.includes(kw)) {
        // Even if date string didn't exactly match, treat as match only if iso equals profile
        if (candidate.iso === normalizedProfile) {
          return {
            isValid: true,
            message: "Birthdate verified.",
            parsedDates,
          };
        }
      }
    }
  }

  return {
    isValid: false,
    message: "Verification failed: Mismatched birthdate or unclear image.",
    parsedDates,
  };
}
