import "dotenv/config";
import crypto from "crypto";
import { Client } from "pg";
import { embedText } from "../lib/chatbot/gemini";

type KnowledgeChunk = {
  content: string;
  metadata: {
    category: string;
    language?: string;
  };
};

const chunks: KnowledgeChunk[] = [
  {
    content:
      "SKonnect is the scholarship management system of the Sangguniang Kabataan (SK) of Barangay Pico, La Trinidad, Benguet, Philippines. It was developed as a capstone project by students of King's College of the Philippines. SKonnect replaces manual, paper-based SKEAP processes with a centralized digital platform. It includes a public-facing youth portal and a multilingual AI helpdesk chatbot that responds in English, Filipino (Tagalog), and Ilocano.",
    metadata: {
      category: "system_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect's main modules are: (1) SKEAP Scholarship Management — for managing scholar records, compliance documents, and grantee status; (2) Grantee Dashboard — an overview of active, graduated, and removed scholars; (3) Public Youth Portal — provides SKEAP information and inquiry submission; (4) Automated Email Reminder System — sends deadline reminders and status change alerts; (5) AI Helpdesk Chatbot — answers SKEAP questions 24/7 in English, Filipino, and Ilocano; and (6) System Administration — manages accounts, API keys, and audit logs.",
    metadata: {
      category: "system_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect is built for the Sangguniang Kabataan of Barangay Pico, La Trinidad, Benguet, Philippines. The SK is the official governing body of the youth in every barangay in the Philippines under Republic Act No. 10742 (SK Reform Act of 2015). The SK Chairperson is Gabe C. Hilario. SK officials administer the SKEAP scholarship. The SK office is located at Barangay Pico, La Trinidad, Benguet.",
    metadata: {
      category: "system_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP stands for Sangguniang Kabataan Educational Assistance Program. It is the scholarship program administered by the SK of Barangay Pico, La Trinidad, Benguet. SKEAP provides educational financial assistance to eligible youth residents aged 15 to 30. Applicants may apply at any grade or educational level regardless of current enrollment status or timing when they submit the complete documentary requirements. The number of active grantees changes over time and should be checked from live records rather than static knowledge base text.",
    metadata: {
      category: "skeap_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP eligibility criteria: An applicant must be a resident of Barangay Pico, La Trinidad, Benguet, and a youth aged 15 to 30. Applicants may apply at any grade or educational level regardless of current enrollment status or timing, provided they submit the complete documentary requirements. Current enrollment is not an eligibility requirement. The minimum general average or GPA of 80% (or equivalent grade) applies to maintaining the scholarship each semester.",
    metadata: {
      category: "skeap_overview",
      language: "ENGLISH",
    },
  },
  {
    content: `Official SKEAP policy — household limit and SK official ineligibility:
Exactly one (1) scholar is allowed per household or immediate family. Multiple applicants from the same immediate family cannot be approved simultaneously.
Sitting members or elected officials of the Sangguniang Kabataan of Barangay Pico are strictly ineligible to apply for or receive the SKEAP scholarship.
Search phrases: one scholar per family, one scholar per household, only one sibling, same immediate family, SK official scholarship eligibility, can an SK official apply, Mano ti scholar ti maysa a balay, Sinu dagiti pwedeng mag-apply.`,
    metadata: {
      category: "skeap_policy",
      language: "ENGLISH",
    },
  },
  {
    content: `Official SKEAP policy — eligible applicants and educational levels:
SKEAP is open to youth residents aged 15 to 30 years old. Applicants may apply at any grade or educational level regardless of current enrollment status or timing, provided they submit the complete set of documentary requirements. Current enrollment is not an eligibility requirement. Do not limit applicants to college or vocational students based only on grade level or enrollment status.
Search phrases: age requirement, who can apply, any grade level, enrollment timing, school level, SKEAP applicant eligibility, Sinu dagiti pwedeng mag-apply, sino ang pwedeng mag-apply.`,
    metadata: {
      category: "skeap_policy",
      language: "ENGLISH",
    },
  },
  {
    content: `Official SKEAP policy — physical requirement submission:
Physical document submission is fully permitted. Applicants and grantees may submit their SKEAP requirements in person directly at Barangay Pico Hall or the SK Office instead of uploading them through the online portal.
Search phrases: submit documents in person, physical submission, paper requirements, Barangay Pico Hall, SK Office, Can I submit my requirements at Pico Hall, mabalin nga isumiter dagiti dokumento idiay Barangay Hall.`,
    metadata: {
      category: "skeap_policy",
      language: "ENGLISH",
    },
  },
  {
    content: `Official SKEAP policy — inquiry response timeline:
Official response times depend on the real-time availability of SK officials. Youth constituents should be assured that inquiries are reviewed as quickly as possible, typically within one hour during office hours. This is a typical timeframe, not a guaranteed service-level deadline.
Search phrases: how long for a response, inquiry reply time, when will SK respond, response during office hours, kasano kabayag ti sungbat, gaano katagal sumagot ang SK.`,
    metadata: {
      category: "skeap_policy",
      language: "ENGLISH",
    },
  },
  {
    content: `Where to get SKEAP application requirements (Saan kukunin ang mga requirements / Papanak alaen dagiti requirements / Ayna ti pag alaak kadagita nga requirements):
- Barangay Certificate of Residency: Get this at the Barangay Hall. (Kunin sa Barangay / Alaen idiay Barangay / Pag alaak: Barangay Hall)
- Certificate of Enrollment, Latest Grade Report, or Transcript of Records (TOR): Get this at your School. (Kunin sa Eskwelahan / Alaen idiay Eskwelaan / Pag alaak: Eskwelaan)
- Family Income Certificate or Income Tax Return (ITR): Get this from where your parents are working. (Kunin sa trabaho ng magulang / Alaen idiay pagubraan iti nagannak)
- SKEAP Application Form: You can download this directly from the SKEAP portal. (Kunin sa SKEAP portal / Alaen idiay SKEAP portal / Pag alaak: SKEAP portal)

(Keywords for vector search: Saan kukunin, Papanak alaen, Aynak nga alan, Adino nga alak, Papanak mangala, sadino, ayan, Ayna ti pag alaak, Ayna ti pagalaak, pagalaak, kadagita nga requirements)`,
    metadata: {
      category: "skeap_requirements_location",
      language: "FILIPINO",
    },
  },
  {
    content: `Pangalaan iti amin nga requirements para iti SKEAP (Where to get all SKEAP requirements):
- Barangay Certificate of Residency / Indigency: Alaen wenno kumpirmaen idiay Barangay Hall ti Pico.
- Certificate of Enrollment / Grade Report / Transcript of Records (TOR): Alaen idiay Registrar wenno opisina ti eskuela/unibersidad mo.
- Family Income Certificate / Income Tax Return (ITR): Alaen idiay pagtatrabahuan ti nagannak mo (employer) wenno BIR/MSWDO.
- Birth Certificate / Valid ID: Alaen idiay PSA (Philippine Statistics Authority) wenno Local Civil Registrar.
- SKEAP Application Form: I-download wenno alaen ti kopia idiay SKEAP portal.

(Vector search keywords: pag alaak, pagalaak, papanak alaen, aynak nga alan, adino nga alak, dagijy, dagiti, daduma, daduma nga requirements, ngy, ngay, papel, dokumento, requirement, saan kukunin)`,
    metadata: {
      category: "skeap_requirements_location_ilocano",
      language: "ILOCANO",
    },
  },
  {
    content: `Where to get/obtain SKEAP application requirements:
- Barangay Certificate of Residency / Indigency: Obtain from the Barangay Hall of Pico.
- Certificate of Enrollment (COE) / Registration Form: Request from your school's Registrar Office or download via your school student portal.
- Grade Report / Transcript of Records (TOR): Request from your school Registrar or Department Dean.
- Birth Certificate: Obtain from the Philippine Statistics Authority (PSA) or Local Civil Registrar (LCR).
- Certificate of Tax Exemption / Low Income: Obtain from the BIR or Municipal Social Welfare and Development Office (MSWDO) / Barangay Hall.
- Application Form: Download directly from the SKEAP portal or pick up a printed copy at the Barangay Hall of Pico.`,
    metadata: {
      category: "skeap_requirements_issuance",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP application documents: Applicants must submit the complete documentary requirements in the current SKEAP checklist. The listed documents include: (1) Birth Certificate or Valid ID — to verify identity and age; (2) Barangay Certificate of Residency — to prove residency in Barangay Pico; (3) Certificate of Enrollment; (4) Latest grade report or Transcript of Records; (5) Family income certificate or income tax return; (6) Application form (paper-based or online through SKonnect). A recommendation letter is not required. These document requirements do not change the eligibility rule: applicants aged 15 to 30 may apply regardless of current enrollment status or educational level.",
    metadata: {
      category: "skeap_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP semester compliance requirements: Every semester, active SKEAP grantees must submit the following documents to maintain their scholarship: (1) Certificate of Enrollment for the current semester — to prove continued enrollment; (2) Grade report or Class card from the previous semester — to verify that the minimum GPA of 80% was maintained. Failure to submit these on time may result in follow-up by SK officials or an extension being granted. Failure to meet the grade requirement results in immediate removal from the program.",
    metadata: {
      category: "skeap_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP grantee status categories: SKEAP grantees are classified under one of three official status categories in SKonnect: (1) Active — currently receiving the scholarship and compliant with semester requirements; (2) Graduated — has completed their degree or program and no longer needs the scholarship; (3) Removed — failed to meet the eligibility criteria, particularly the minimum GPA of 80%, and has been removed from the program by a majority vote of SK officials. There is no formal written appeal process; removed grantees may speak directly to the SK Chairperson.",
    metadata: {
      category: "skeap_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP compliance deadlines and notifications: The system sends automated email reminders to SKEAP grantees 1 week before their semester document submission deadline. Grantees also receive instant email notifications when their scholarship status changes (e.g., from Active to Removed, or when documents are approved). If a grantee fails to submit documents by the deadline, the SK Chairperson or officials will personally follow up and may grant an extension on a case-by-case basis. There is no automatic suspension or forfeiture for missed deadlines — the process is currently handled by SK officials with flexibility.",
    metadata: {
      category: "skeap_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP grade requirement: The minimum grade required to maintain the SKEAP scholarship is 80 (on a 100-point scale, or the equivalent general weighted average). If a grantee's grade report submitted each semester falls below 80, they are immediately removed from the program. Removal decisions are made by a majority vote of SK officials, not by the Chairperson alone.",
    metadata: {
      category: "skeap_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "How to apply for SKEAP: Youth residents aged 15–30 who are residents of Barangay Pico may apply at any grade or educational level regardless of current enrollment status or timing, provided they submit the complete documentary requirements. Current enrollment is not an eligibility requirement. Applicants may submit documents online through the SKEAP portal or physically at Barangay Pico Hall/SK Office. The SK officials review submitted applications and applicants will be notified about their application status.",
    metadata: {
      category: "skeap_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP portal: The SKEAP portal is the part of SKonnect accessible to youth residents of Barangay Pico. It has a dedicated SKEAP information page with eligibility criteria, document requirements, and instructions on how to apply. Youth can also submit formal inquiries to the SK through the portal's inquiry form or by chatting with the AI chatbot.",
    metadata: {
      category: "portal",
      language: "ENGLISH",
    },
  },
  {
    content:
      "Youth resident account: Youth residents of Barangay Pico can create an account on the SKEAP portal to check SKEAP information and eligibility, submit inquiries to SK officials, and use the AI chatbot for 24/7 assistance. Registration for a youth account requires a valid email address and proof of residency in Barangay Pico.",
    metadata: {
      category: "portal",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP grantee portal access: SKEAP grantees have a special login on SKonnect that gives them access to their personal scholarship dashboard. Through their dashboard, grantees can view their current scholarship status (Active, Graduated, or Removed), see their compliance submission history and evaluation results for each semester, upload required semester documents (Certificate of Enrollment and grade report), and receive automated email reminders before submission deadlines.",
    metadata: {
      category: "portal",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect AI Helpdesk Chatbot: SKonnect includes a multilingual AI chatbot that is available 24/7 on the SKEAP portal. The chatbot can answer questions in English, Filipino (Tagalog), and Ilocano about SKEAP eligibility, required documents, application steps, and who to contact for scholarship concerns. The chatbot cannot process applications, approve documents, or make administrative decisions — those functions are handled exclusively by SK officials.",
    metadata: {
      category: "chatbot",
      language: "ENGLISH",
    },
  },
  {
    content:
      "What the AI chatbot can answer: The SKonnect chatbot is designed to answer questions about how to apply for SKEAP, application and compliance requirements, eligibility criteria, submission deadlines, and who to contact for scholarship concerns. For questions it cannot answer, it directs users to submit a formal inquiry to SK officials through the portal's inquiry form.",
    metadata: {
      category: "chatbot",
      language: "ENGLISH",
    },
  },
  {
    content:
      "Chatbot language support: The SKonnect AI chatbot understands and responds in three languages: English, Filipino (Tagalog), and Ilocano. Users can ask their question in any of these three languages, and the chatbot will respond in the same language. This is important for Barangay Pico because most youth residents speak Filipino/Tagalog and Ilocano. The chatbot does not currently support Kankanaey or Ibaloi. The public portal operates primarily in English and Filipino (bilingual).",
    metadata: {
      category: "chatbot",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect Notification System: The system sends automated email notifications for SKEAP deadline reminders and scholarship status changes. Grantees receive deadline reminders before semester document submissions and are notified when their scholarship status changes.",
    metadata: {
      category: "notifications",
      language: "ENGLISH",
    },
  },
  {
    content:
      "How to contact the SK of Barangay Pico: Youth residents can contact the SK of Barangay Pico through the following channels: (1) Direct visit to the Barangay Hall at Barangay Pico, La Trinidad, Benguet; (2) Facebook page message — the SK has an official Facebook page; (3) Phone call to SK officials; (4) Formal inquiry form on the SKonnect youth portal — messages submitted here go directly to the SK officials' administrative dashboard; (5) AI chatbot on SKonnect — for quick questions available 24/7. For concerns that the chatbot cannot resolve, it directs users to submit a formal inquiry through the portal.",
    metadata: {
      category: "contact",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SK official contact information: The SK Chairperson of Barangay Pico is Gabe C. Hilario. For scholarship-related concerns, applicants and grantees may contact the SK Chairperson or any SK official. The SK office is located at the Barangay Hall of Barangay Pico, La Trinidad, Benguet. For online inquiries, the SKonnect portal has a dedicated inquiry/contact form that routes messages to the SK officials' dashboard.",
    metadata: {
      category: "contact",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect technology stack: SKonnect is built with the following technologies: Frontend — Next.js (App Router) and React, hosted as a responsive web application accessible on both desktop and mobile browsers. Backend — Supabase (PostgreSQL database with pgvector extension for vector similarity search). AI Chatbot — Google Gemini API for both text embedding (generating vector representations of text) and answer generation (RAG pipeline). The chatbot uses the RAG (Retrieval-Augmented Generation) approach: user queries are embedded, matched against the chat_embeddings table using vector search, and the top matching context chunks are passed to Gemini to generate an accurate, grounded answer.",
    metadata: {
      category: "technical",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect internet and device context: The SK Office at Barangay Pico has an intermittent or slow Wi-Fi connection. SK officials primarily use official barangay desktop computers or laptops, and also use smartphones or tablets for administrative work. Because of the potentially slow connection, SKonnect is designed as a lightweight responsive web application — not a native mobile app — to ensure it works even on lower-bandwidth connections. The public youth portal is also accessible from mobile browsers.",
    metadata: {
      category: "technical",
      language: "ENGLISH",
    },
  },
];

function createPostgresClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in environment.");
  }

  return new Client({ connectionString: databaseUrl });
}

function contentToDeterministicId(content: string) {
  const hash = crypto.createHash("sha256").update(content, "utf8").digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureEmbeddingDimension(client: Client) {
  const result = await client.query(
    `SELECT format_type(atttypid, atttypmod) AS type
     FROM pg_attribute
     WHERE attrelid = 'public.chat_embeddings'::regclass
       AND attname = 'embedding';`
  );

  const currentType = result.rows?.[0]?.type;
  if (currentType === "vector(3072)") {
    return;
  }

  const countResult = await client.query(`SELECT count(*) AS count FROM public.chat_embeddings;`);
  const rowCount = Number(countResult.rows?.[0]?.count ?? 0);

  if (rowCount > 0) {
    throw new Error(
      `Cannot alter chat_embeddings.embedding from ${currentType} to vector(3072) because the table already contains ${rowCount} rows.`
    );
  }

  console.log(`Altering chat_embeddings.embedding from ${currentType} to vector(3072)...`);
  await client.query(`ALTER TABLE public.chat_embeddings ALTER COLUMN embedding TYPE vector(3072);`);
}

async function seedKnowledgeBase() {
  const client = createPostgresClient();
  await client.connect();
  await ensureEmbeddingDimension(client);
  await client.query(
    `DELETE FROM public.chat_embeddings
     WHERE lower("sourceType") = 'events'
        OR content ILIKE '%event%'
        OR (
          lower("sourceType") = 'skeap_overview'
          AND (
            content LIKE $1
            OR content LIKE $2
            OR content LIKE $3
            OR content LIKE $4
          )
        )
        OR (
          lower("sourceType") = 'skeap_policy'
          AND content LIKE $5
        )
        OR (
          lower("sourceType") = 'governance'
          AND (
            content LIKE 'SKonnect audit trail:%'
            OR content LIKE 'SKonnect user roles:%'
            OR content LIKE 'Data turnover and continuity:%'
          )
        )
        OR (
          lower("sourceType") = 'chatbot'
          AND (
            content LIKE 'Sample chatbot questions and answers (%'
            OR (
              content LIKE 'SKonnect AI Helpdesk Chatbot:%'
              AND content ILIKE '%RAG%'
            )
          )
        );`,
    [
      "%currently enrolled in college or vocational programs%",
      "%provided they are enrolled in an educational institution%",
      "%provided that they are enrolled in an educational institution%",
      "%and enrolled in an educational institution may apply%",
      "%provided that they are enrolled in an educational institution%",
    ]
  );

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const chunkId = contentToDeterministicId(chunk.content);
    const preview = chunk.content.slice(0, 60).replace(/\s+/g, " ");

    console.log(`Embedding chunk ${index + 1} of ${chunks.length}: ${preview}...`);

    const embedding = await embedText(chunk.content);
    const embeddingVector = `[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]`;

    const query = `
      INSERT INTO public.chat_embeddings (id, content, language, "sourceType", embedding)
      VALUES ($1, $2, $3, $4, $5::vector)
      ON CONFLICT (id)
      DO UPDATE SET content = EXCLUDED.content, language = EXCLUDED.language, "sourceType" = EXCLUDED."sourceType", embedding = EXCLUDED.embedding;
    `;

    try {
      await client.query(query, [
        chunkId,
        chunk.content,
        chunk.metadata.language ?? "ENGLISH",
        chunk.metadata.category,
        embeddingVector,
      ]);
    } catch (error) {
      console.error(`Failed to upsert chunk ${index + 1}:`, error instanceof Error ? error.message : error);
      await client.end();
      process.exit(1);
    }

    console.log(`Seeded chunk ${index + 1} of ${chunks.length}.`);
    await sleep(200);
  }

  await client.end();
  console.log("Knowledge base seed completed successfully.");
}

seedKnowledgeBase().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
