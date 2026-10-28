export const SKEAP_DOCUMENT_NAMES_SYSTEM_DIRECTIVE =
  "CRITICAL RULE: When answering queries in Filipino or Ilocano, NEVER translate the names of official SKEAP requirements. Always use the exact English document names (e.g., 'Application Form', 'Birth Certificate', 'Certificate of Residency', 'Form 138'). Do not use localized terms like 'Katibayan ng Kapanganakan' or 'Katibayan ng Paninirahan'.";

const REQUIREMENTS_CONTEXT =
  /\b(requirements?|documents?|papel|papeles|dokumento|kasapulan)\b/i;
const REQUIREMENTS_PROBLEM =
  /\b(lacking|incomplete|missing|wrong|incorrect|invalid|correction|correct|kulang|kurang|mali|kamali|mabaliktad|salungasing|needs?\s+(?:to\s+be\s+)?(?:fixed|updated|corrected))\b/i;

export function isIncompleteRequirementsQuestion(question: string) {
  return REQUIREMENTS_CONTEXT.test(question) && REQUIREMENTS_PROBLEM.test(question);
}

export function formatIncompleteRequirementsAnswer(language: "ENGLISH" | "FILIPINO" | "ILOCANO") {
  if (language === "FILIPINO") {
    return "Kung kulang ang iyong mga requirements, hindi ka makakapagpatuloy sa iyong aplikasyon. Gayunpaman, kung may maling naisumiteng dokumento, maaari itong ibalik ng SK Admin sa iyo upang maiwasto at maipasa muli.";
  }
  if (language === "ILOCANO") {
    return "Nu kurang dagiti requirements-mo, hanka makatultuloy iti aplikasyonmo. Ngem nu adda kamali wenno salungasing kadagiti naisumiter a dokumento, mabalin nga isubli ti SK Admin ti aplikasyonmo tapno ma-edit-mo ken maipasamo manen.";
  }
  return "If your requirements are lacking, you will not be able to proceed with your application. However, if any submitted document is incorrect or needs updates, the SK Admin can return your application so you can edit and resubmit it.";
}

export const SKEAP_APPLICATION_REQUIREMENT_CHUNKS = [
  {
    content: `To apply for the SKEAP, all applicants shall be required to submit the following documents for verification, as well as for the records of the Barangay:
1. Application Form
2. 1 piece 2"x2" latest I.D. picture
3. Original and Photocopy of Birth Certificate
4. Certificate of Low-income of Parents or Guardian stating for the purpose of "Sangguniang Kabataan Educational Assistance Program".
5. Certificate of Residency
6. Certified True Copy of his/her enrollment form or Certificate of Enrollment
7. Grades issued by the school registrar for College and for Tech-Voc applicants/students
8. Certified true copy of his/her report card or form 138 for High School students`,
    metadata: { category: "skeap_application_requirements", language: "ENGLISH" },
  },
  {
    content: `Para maka-apply sa SKEAP, ang lahat ng aplikante ay kinakailangang magsumite ng mga sumusunod na dokumento para sa beripikasyon at para sa rekord ng Barangay:
1. Application Form
2. 1 piece 2"x2" latest I.D. picture
3. Original and Photocopy of Birth Certificate
4. Certificate of Low-income of Parents or Guardian stating for the purpose of "Sangguniang Kabataan Educational Assistance Program".
5. Certificate of Residency
6. Certified True Copy of his/her enrollment form or Certificate of Enrollment
7. Grades issued by the school registrar for College and for Tech-Voc applicants/students
8. Certified true copy of his/her report card or form 138 for High School students`,
    metadata: { category: "skeap_application_requirements", language: "FILIPINO" },
  },
  {
    content: `Tapno maka-apply iti SKEAP, amin nga aplikante ket masapul nga isubmitar dagiti sumaganad a dokumento para iti beripikasyon ken para iti rekord ti Barangay:
1. Application Form
2. 1 piece 2"x2" latest I.D. picture
3. Original and Photocopy of Birth Certificate
4. Certificate of Low-income of Parents or Guardian stating for the purpose of "Sangguniang Kabataan Educational Assistance Program".
5. Certificate of Residency
6. Certified True Copy of his/her enrollment form or Certificate of Enrollment
7. Grades issued by the school registrar for College and for Tech-Voc applicants/students
8. Certified true copy of his/her report card or form 138 for High School students`,
    metadata: { category: "skeap_application_requirements", language: "ILOCANO" },
  },
] as const;

const REQUIREMENT_INTRODUCTIONS = {
  ENGLISH: "SKEAP applicants must be 15 to 30 years old. The required documents are:",
  FILIPINO: "Ang mga aplikante sa SKEAP ay dapat 15 hanggang 30 taong gulang. Narito ang mga kinakailangang dokumento:",
  ILOCANO: "Masapul nga agtawen iti 15 agingga iti 30 dagiti aplikante iti SKEAP. Dagitoy dagiti dokumento a masapul:",
} as const;

export function isSkeapRequirementsListQuery(question: string) {
  const normalized = question.toLowerCase();
  const asksWhereToGetRequirements =
    /\b(where|saan|papanak|ayna|pagalaak|alaen|kunin|kukunin)\b/.test(normalized) &&
    /\b(requirement|document|papel|dokumento|requirements|documents)\b/.test(normalized);
  return !asksWhereToGetRequirements &&
    /\b(requirements?|documents?|papel|papeles|dokumento|dokumento|kasapulan)\b/.test(normalized) &&
    /\b(skeap|application|apply|applicant|submit|submission|need|required|requirements?|documents?|papel|papeles|dokumento|kasapulan)\b/.test(normalized);
}

export function formatSkeapRequirementsAnswer(language: keyof typeof REQUIREMENT_INTRODUCTIONS) {
  const chunk = SKEAP_APPLICATION_REQUIREMENT_CHUNKS.find(
    (item) => item.metadata.language === language
  );
  if (!chunk) throw new Error(`Missing SKEAP requirements chunk for ${language}.`);

  const documentList = chunk.content.slice(chunk.content.indexOf("\n") + 1);
  return `${REQUIREMENT_INTRODUCTIONS[language]}\n${documentList}`;
}
