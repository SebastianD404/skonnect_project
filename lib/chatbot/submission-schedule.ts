import type { Language } from "@prisma/client";
import type { AcademicTermWindow } from "@/lib/academic-term-schedule";

export type SubmissionScheduleIntent = "SKEAP" | "KK_PROFILING" | "ACADEMIC";

export type LiveSubmissionSchedules = {
  skeap: {
    isOpen: boolean;
    startDate: string | null;
    endDate: string | null;
  };
  kkProfiling: {
    isOpen: boolean;
    startDate: string | null;
    endDate: string | null;
  };
  academicTerm: AcademicTermWindow;
};

const TEMPORAL_TERMS =
  /\b(when|date|dates|open|opens|opening|close|closes|closing|schedule|deadline|due|kailan|kelan|petsa|hanggang|magbubukas|mabukas|bukas|isara|aglukat|inton|agturong)\b/i;

const SUBMISSION_TERMS =
  /\b(submission|submissions|submit|submitting|requirements?|documents?|dokumento|ipasa|panagipasa|isumiter|application|applications|skeap|profiling|kk|grades?|semester|academic)\b/i;

const SCHEDULE_POLICY_CONSEQUENCES =
  /\b(happen(?:s|ed)?|what happens|consequence|consequences|miss(?:es|ed|ing)?|late|mangyayari|nangyari|inabutan|hindi\s+(?:nakapasa|nakapagpasa|naipasa)|di\s+(?:nakapasa|nakapagpasa|naipasa)|epekto|parusa|maparusahan)\b/i;

export function isSchedulePolicyQuestion(question: string) {
  return TEMPORAL_TERMS.test(question) && SCHEDULE_POLICY_CONSEQUENCES.test(question);
}

export function getSubmissionScheduleIntent(question: string): SubmissionScheduleIntent | null {
  if (isSchedulePolicyQuestion(question)) return null;
  if (!TEMPORAL_TERMS.test(question) || !SUBMISSION_TERMS.test(question)) return null;

  if (/\b(kk|profiling|youth profiling)\b/i.test(question)) return "KK_PROFILING";
  if (/\b(grade|grades|semester|academic|grantee|requirements?|documents?|dokumento|ipasa|panagipasa|isumiter)\b/i.test(question)) {
    return "ACADEMIC";
  }
  if (/\b(skeap|scholarship|apply|application|applications)\b/i.test(question)) return "SKEAP";
  return "SKEAP";
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date);
}

function localized(language: Language, english: string, filipino: string, ilocano: string) {
  if (language === "FILIPINO") return filipino;
  if (language === "ILOCANO") return ilocano;
  return english;
}

function describeApplicationWindow(
  language: Language,
  label: string,
  schedule: LiveSubmissionSchedules["skeap"] | LiveSubmissionSchedules["kkProfiling"]
) {
  const start = formatDate(schedule.startDate);
  const end = formatDate(schedule.endDate);
  if (!start && !end) {
    if (schedule.isOpen) {
      return localized(
        language,
        `${label} submissions are currently being accepted. No separate opening or closing dates have been set.`,
        `Tumatanggap na ngayon ng mga submission para sa ${label}. Wala pang itinakdang hiwalay na petsa ng pagbubukas o pagsasara.`,
        `Agtarima ita ti ${label} kadagiti ipasa. Awan pay ti naisangsangayan a petsa ti panaglukat wenno panagserra.`,
      );
    }
    return localized(
      language,
      `${label} submissions are currently closed, and no official opening date has been set.`,
      `Kasalukuyang sarado ang pagsusumite para sa ${label}, at wala pang opisyal na petsa ng pagbubukas.`,
      `Naserra ti panagipasa para iti ${label}, ken awan pay ti opisial a petsa ti panaglukat.`,
    );
  }

  if (schedule.isOpen) {
    const deadline = end
      ? localized(language, ` They close on ${end}.`, `Magsasara ito sa ${end}.`, `Agserra daytoy inton ${end}.`)
      : "";
    return localized(
      language,
      `${label} submissions are currently open.${deadline}`,
      `Bukas na ngayon ang pagsusumite para sa ${label}.${deadline}`,
      `Nalukat itan ti panagipasa para iti ${label}.${deadline}`,
    );
  }

  if (start) {
    const endText = end
      ? localized(language, ` and close on ${end}`, ` at magsasara sa ${end}`, ` ken agserra inton ${end}`)
      : "";
    return localized(
      language,
      `${label} submissions open on ${start}${endText}.`,
      `Magbubukas ang pagsusumite para sa ${label} sa ${start}${endText}.`,
      `Agbuklas ti panagipasa para iti ${label} inton ${start}${endText}.`,
    );
  }

  return localized(
    language,
    `${label} submissions are currently closed. The configured closing date is ${end}.`,
    `Kasalukuyang sarado ang pagsusumite para sa ${label}. Ang itinakdang petsa ng pagsasara ay ${end}.`,
    `Naserra itan ti panagipasa para iti ${label}. Ti naituding a petsa ti panagserra ket ${end}.`,
  );
}

function describeAcademicWindow(language: Language, window: AcademicTermWindow) {
  const start = formatDate(window.opensAt);
  const end = formatDate(window.closesAt);
  const term = window.semester ? ` (${window.semester})` : "";

  if (window.status === "OPEN" && end) {
    return localized(
      language,
      `The academic document submission window${term} is currently open and closes on ${end}.`,
      `Bukas na ang submission para sa ${window.semester ?? "kasalukuyang termino"} at magsasara sa ${end}.`,
      `Nalukat itan ti panagipasa kadagiti akademiko a dokumento${term} ken agserra inton ${end}.`,
    );
  }
  if (window.status === "UPCOMING" && start) {
    return localized(
      language,
      `The next academic document submission window${term} opens on ${start}${end ? ` and closes on ${end}` : ""}.`,
      `Magbubukas sa ${start} ang susunod na panahon ng pagsusumite ng mga akademikong dokumento${term}${end ? ` at magsasara sa ${end}` : ""}.`,
      `Agbuklas inton ${start} ti sumaruno a tiempo ti panagipasa kadagiti akademiko a dokumento${term}${end ? ` ken agserra inton ${end}` : ""}.`,
    );
  }
  if (window.status === "CLOSED" && end) {
    return localized(
      language,
      `The latest academic document submission window${term} closed on ${end}. No upcoming window is scheduled.`,
      `Nagsara noong ${end} ang pinakahuling panahon ng pagsusumite ng mga akademikong dokumento${term}. Wala pang nakatakdang susunod na panahon.`,
      `Naserra idi ${end} ti kaudian a tiempo ti panagipasa kadagiti akademiko a dokumento${term}. Awan pay ti naituding a sumaruno a tiempo.`,
    );
  }
  return localized(
    language,
    "No academic document submission schedule has been configured yet.",
    "Wala pang naitakdang iskedyul para sa pagsusumite ng mga akademikong dokumento.",
    "Awan pay ti naituding a iskedyul para iti panagipasa kadagiti akademiko a dokumento.",
  );
}

export function formatSubmissionScheduleAnswer(
  intent: SubmissionScheduleIntent,
  language: Language,
  schedules: LiveSubmissionSchedules,
) {
  if (intent === "KK_PROFILING") {
    return describeApplicationWindow(language, "KK Profiling", schedules.kkProfiling);
  }
  if (intent === "ACADEMIC") {
    return describeAcademicWindow(language, schedules.academicTerm);
  }
  return describeApplicationWindow(language, "SKEAP", schedules.skeap);
}
