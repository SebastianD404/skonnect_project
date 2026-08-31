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
      "SKonnect is the official web-based youth services and scholarship management system of the Sangguniang Kabataan (SK) of Barangay Pico, La Trinidad, Benguet, Philippines. It was developed as a capstone project by students of King's College of the Philippines. SKonnect replaces the SK's manual, paper-based processes with a centralized digital platform. The system covers two core functions: SKEAP scholarship management and SK event registration. It also includes a public-facing youth portal and a multilingual AI helpdesk chatbot that responds in English, Filipino (Tagalog), and Ilocano.",
    metadata: {
      category: "system_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect has six main modules: (1) SKEAP Scholarship Management — for managing scholar records, compliance documents, and grantee status; (2) Grantee Dashboard — a real-time overview of active, graduated, and removed scholars; (3) Event Management System — for creating events with slot limits, auto-closure, and payout scheduling; (4) Public Youth Portal — open to all youth residents to view events, SKEAP info, and submit inquiries; (5) Automated Email Reminder System — sends deadline reminders, status change alerts, and event announcements; (6) AI Helpdesk Chatbot — answers frequently asked questions 24/7 in English, Filipino, and Ilocano. There is also a System Administration module for managing accounts, API keys, and audit logs.",
    metadata: {
      category: "system_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect is built for the Sangguniang Kabataan of Barangay Pico, La Trinidad, Benguet, Philippines. The SK is the official governing body of the youth in every barangay in the Philippines under Republic Act No. 10742 (SK Reform Act of 2015). The SK Chairperson is Gabe C. Hilario. SK officials manage youth programs including the SKEAP scholarship and annual events like the Linggo ng Kabataan (Katipunan ng Kabataan). The SK office is located at Barangay Pico, La Trinidad, Benguet.",
    metadata: {
      category: "system_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP stands for Sangguniang Kabataan Educational Assistance Program. It is the scholarship program administered by the SK of Barangay Pico, La Trinidad, Benguet. SKEAP provides educational financial assistance to eligible youth residents who are currently enrolled in college or vocational programs. The number of active grantees changes over time and should be checked from the live system records rather than from static knowledge base text.",
    metadata: {
      category: "skeap_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP eligibility criteria: To qualify for the SKEAP scholarship, an applicant must meet all of the following requirements: (1) Residency — the applicant must be a resident of Barangay Pico, La Trinidad, Benguet; (2) Age — the applicant must be within the youth age bracket (15 to 30 years old) as defined by SK guidelines; (3) GPA — the applicant must have a minimum general average or GPA of 80% (or equivalent grade) to apply and to maintain the scholarship each semester.",
    metadata: {
      category: "skeap_overview",
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
      "SKEAP application documents: To apply for SKEAP, the following documents are required: (1) Birth Certificate or Valid ID — to verify identity and age; (2) Barangay Certificate of Residency — to prove residency in Barangay Pico; (3) Certificate of Enrollment — to confirm active enrollment in an educational institution; (4) Latest grade report or Transcript of Records — to verify academic standing; (5) Family income certificate or income tax return — to assess financial need; (6) Application form (paper-based or online through SKonnect). A recommendation letter is not required.",
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
      "How to apply for SKEAP: Youth residents who meet the eligibility criteria (resident of Barangay Pico, aged 15–30, GPA of at least 80%) can apply for SKEAP through the SKEAP portal when application slots are open. The online application form collects personal information, academic details, and allows document uploads. The SK officials review submitted applications through the administrative dashboard. Applicants will be notified via email about the status of their application.",
    metadata: {
      category: "skeap_overview",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SK Pico holds approximately 7 to 10 events per year. The types of events regularly organized by the SK include: (1) Katipunan ng Kabataan — a youth assembly and payout event where SKEAP scholarship stipends are distributed to grantees; (2) Sports tournaments or games; (3) Livelihood and skills training; (4) Health or medical missions; (5) Clean-up drives and environmental programs; (6) Cultural or arts events. Scholarship payout ceremonies are not held as separate events; payouts happen during the Katipunan ng Kabataan.",
    metadata: {
      category: "events",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect Event Management: SK officials can create events in SKonnect by entering the event title, description, date, time, venue, and maximum number of participant slots. The system displays real-time slot availability publicly on the SKEAP portal. When all slots are filled, registration automatically closes and no more participants can register. Events go through the following status stages: Upcoming → Registration Open → Registration Closed → Completed.",
    metadata: {
      category: "events",
      language: "ENGLISH",
    },
  },
  {
    content:
      "Katipunan ng Kabataan: This is the primary youth assembly event organized by the SK of Barangay Pico. It serves as both a youth gathering and the payout event where active SKEAP grantees receive their scholarship stipends. The schedule for the Katipunan ng Kabataan is announced through the SKonnect public portal, the SK's Facebook page, and via personal text or call to grantees. All registered youth portal users receive automatic email notifications when a new event is posted.",
    metadata: {
      category: "events",
      language: "ENGLISH",
    },
  },
  {
    content:
      "How to register for an SK event through SKonnect: Youth residents can register for SK events through the SKEAP portal. Each event listing shows the event title, description, date, time, venue, number of remaining registration slots, eligibility requirements, and registration deadline. To register, a youth resident must be logged in to the SKEAP portal and click the Register button before the deadline or before slots run out. A registration confirmation email is sent automatically after signing up. Some events have slot limits, and registration closes automatically when full.",
    metadata: {
      category: "events",
      language: "ENGLISH",
    },
  },
  {
    content:
      "Event information visible to the public: For each SK event posted on the SKEAP portal, the following information is publicly visible: event title and description, date, time, and venue, number of remaining registration slots, who can register (eligibility), and the registration deadline. Payout schedule information for the Katipunan ng Kabataan is visible to SKEAP grantees. Contact person details are not listed publicly — inquiries can be submitted through the portal's inquiry form or the AI chatbot.",
    metadata: {
      category: "events",
      language: "ENGLISH",
    },
  },
  {
    content:
      "Event slot limits: Some SK events have a maximum number of participants. When the slot limit is reached, SKonnect automatically closes registration and displays the event as full. This has happened in the past — events have been closed or had to turn away participants due to full capacity. SKonnect addresses this by showing real-time slot counts and auto-closing registration to prevent overbooking.",
    metadata: {
      category: "events",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP portal: The SKEAP portal is the part of SKonnect accessible to all youth residents of Barangay Pico without needing to log in. It displays all upcoming SK events with dates, venues, and live slot counters. Residents can click on any event to see full details and register. The portal also has a dedicated SKEAP information page with eligibility criteria, document requirements, and instructions on how to apply. Youth can also submit formal inquiries to the SK through the portal's inquiry form or by chatting with the AI chatbot.",
    metadata: {
      category: "portal",
      language: "ENGLISH",
    },
  },
  {
    content:
      "Youth resident account: Youth residents of Barangay Pico can create an account on the SKEAP portal. With an account, they can: register for SK events online, receive email notifications about upcoming events, check SKEAP information and eligibility, submit inquiries to SK officials, and use the AI chatbot for 24/7 assistance. Registration for a youth account requires a valid email address and proof of residency in Barangay Pico.",
    metadata: {
      category: "portal",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SK Announcements Feed: SKonnect has a dedicated announcements feed on the SKEAP portal that displays official SK news, program updates, and event announcements. This feed is separate from the SK's Facebook page and is always available and organized. Youth residents who register on the portal receive email notifications when new announcements are posted.",
    metadata: {
      category: "portal",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKEAP grantee portal access: SKEAP grantees have a special login on SKonnect that gives them access to their personal scholarship dashboard in addition to the SKEAP portal features. Through their dashboard, grantees can: view their current scholarship status (Active, Graduated, or Removed), see their compliance submission history and evaluation results for each semester, upload required semester documents (Certificate of Enrollment and grade report), receive automated email reminders before submission deadlines, and check the schedule for upcoming Katipunan ng Kabataan payouts.",
    metadata: {
      category: "portal",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect AI Helpdesk Chatbot: SKonnect includes a multilingual AI chatbot that is available 24/7 on the SKEAP portal. The chatbot can answer questions in English, Filipino (Tagalog), and Ilocano. It uses a RAG (Retrieval-Augmented Generation) pipeline powered by Google Gemini, which means it reads live data from the SKonnect system to give accurate and up-to-date answers about SKEAP eligibility, event schedules, slot availability, how to register, what documents to submit, and who to contact for specific concerns. The chatbot is not able to process applications, approve documents, or make administrative decisions — those functions are handled exclusively by SK officials.",
    metadata: {
      category: "chatbot",
      language: "ENGLISH",
    },
  },
  {
    content:
      "What the AI chatbot can answer: The SKonnect chatbot is designed to answer the following types of questions: (1) How to apply for SKEAP and what the requirements are; (2) Upcoming SK events and their schedules; (3) How to register for an event; (4) Who to contact for a specific concern; (5) What documents to submit and when; (6) SKEAP eligibility criteria; (7) Current event slot availability; (8) Submission deadlines for SKEAP compliance. For questions the chatbot cannot answer, it will direct the user to submit a formal inquiry to the SK officials through the portal's inquiry form.",
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
      "Sample chatbot questions and answers (Filipino/Tagalog):\nQ: Sino ang pwedeng mag-apply sa SKEAP?\nA: Ang SKEAP ay para sa mga estudyante na nakatira sa Barangay Pico, La Trinidad, Benguet, may edad 15–30, at may general average na hindi bababa sa 80%. Kailangan ding ipasa ang Certificate of Enrollment at grade report bawat semester para mapanatili ang scholarship.\n\nQ: Ano ang mga dokumento na kailangan para sa SKEAP?\nA: Ang mga kailangang dokumento para mag-apply sa SKEAP ay: Birth Certificate o Valid ID, Barangay Certificate of Residency, Certificate of Enrollment, pinakabagong grade report o Transcript of Records, family income certificate o income tax return, at ang application form.\n\nQ: May slots pa ba sa susunod na event?\nA: Makikita mo ang bilang ng natitirang slots sa bawat event sa SKonnect youth portal. Awtomatikong magsasara ang registration kapag puno na ang slots.",
    metadata: {
      category: "chatbot",
      language: "ENGLISH",
    },
  },
  {
    content:
      "Sample chatbot questions and answers (Ilocano):\nQ: Siasino ti makaaply iti SKEAP?\nA: Ti SKEAP ket para kadagiti estudiante nga residente ti Barangay Pico, La Trinidad, Benguet, nga addaan edad 15–30, ken addaan general average nga di ubos ti 80%. Masapul pay nga isumiter ti Certificate of Enrollment ken grade report iti tunggal semester.\n\nQ: Ania dagiti dokumento ti masapul para iti SKEAP?\nA: Dagiti masapul nga dokumento iti SKEAP: Birth Certificate wenno Valid ID, Barangay Certificate of Residency, Certificate of Enrollment, nabiit nga grade report wenno Transcript of Records, family income certificate wenno income tax return, ken ti application form.",
    metadata: {
      category: "chatbot",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect Notification System: The system sends automated email notifications for the following events: (1) Deadline Reminders — SKEAP grantees receive an email 1 week before and 1 day before semester document submission deadlines; (2) Status Change Alerts — grantees are notified immediately when their scholarship status changes (e.g., approved, flagged, removed); (3) Event Announcements — when a new SK event is posted, all registered youth portal users receive an email notification; (4) Registration Confirmation — when a youth registers for an event, they immediately receive a confirmation email with event details. The system uses email (and optionally Facebook Messenger notifications) for all alerts. SMS may be added depending on budget approval.",
    metadata: {
      category: "notifications",
      language: "ENGLISH",
    },
  },
  {
    content:
      "Who receives event announcement notifications: All registered youth portal users receive email notifications when a new SK event is published on SKonnect. This includes all youth residents who have created an account on the SKonnect youth portal — not just SKEAP grantees. The system does not currently send targeted notifications only to specific groups unless specified per event.",
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
      "SKonnect user roles: SKonnect has four user roles with distinct permissions: (1) Youth Resident — can access the public portal, browse events, register for events, view SKEAP info, and use the chatbot; (2) SKEAP Grantee — has all youth resident access plus a personal scholarship dashboard to view status, upload compliance documents, and receive deadline reminders; (3) SK Official (Admin) — can manage SKEAP grantees, review documents, create and manage events, view the grantee dashboard, and access the audit trail; (4) Super Admin — holds master control over the entire system, manages credentials, API keys, and system configuration. The Super Admin role is held by the SK Chairperson only.",
    metadata: {
      category: "governance",
      language: "ENGLISH",
    },
  },
  {
    content:
      "SKonnect audit trail: SKonnect maintains an immutable security audit log that records every action performed by SK officials in the system. The audit log shows exactly which logged-in SK official approved, modified, or rejected a grantee's file, changed a record, or updated any system setting, along with the timestamp of the action. This log cannot be altered and serves as the official record of all administrative decisions made through SKonnect. The audit trail was rated as critically important (5 out of 5) by the SK Chairperson during requirements gathering.",
    metadata: {
      category: "governance",
      language: "ENGLISH",
    },
  },
  {
    content:
      "Data turnover and continuity: When an SK election cycle ends and a new administration takes over, SKonnect preserves all records digitally. The new SK administration inherits the complete digital history of scholarship grantees, event records, compliance submissions, and audit logs — unlike the current paper-based system, which is turned over through a physical logbook on an official turnover day. SKonnect ensures institutional continuity and eliminates the risk of losing records during the transition between administrations.",
    metadata: {
      category: "governance",
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
