import { config } from "dotenv";
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  PrismaClient,
  Role,
  Sex,
  SubmissionOcrStatus,
  SubmissionStatus,
} from "@prisma/client";
import { Pool } from "pg";

config({ path: [".env.local", ".env"] });

const DEMO_PASSWORD = "Password123!";
const PRIVATE_DOCUMENT_BUCKET = "private-documents";
const FINAL_SEMESTER = "2026-2027 Second Semester";
const LEGACY_DEMO_DOMAIN = "@skonnect.demo";
const DEMO_SEMESTERS = [
  {
    semester: "2025-2026 First Semester",
    submittedAt: new Date("2025-09-10T04:00:00.000Z"),
    approvedAt: new Date("2025-09-18T04:00:00.000Z"),
  },
  {
    semester: "2025-2026 Second Semester",
    submittedAt: new Date("2026-02-10T04:00:00.000Z"),
    approvedAt: new Date("2026-02-18T04:00:00.000Z"),
  },
  {
    semester: "2026-2027 First Semester",
    submittedAt: new Date("2026-08-10T04:00:00.000Z"),
    approvedAt: new Date("2026-08-18T04:00:00.000Z"),
  },
] as const;

const FINAL_SUBMITTED_AT = new Date("2026-11-18T04:00:00.000Z");

const DEMO_ACCOUNTS = [
  {
    key: "althea-mendoza",
    email: "althea.mendoza@skonnect.com",
    fullName: "Althea Mendoza",
    firstName: "Althea",
    middleName: "Santos",
    lastName: "Mendoza",
    birthDate: new Date("2003-05-18T00:00:00.000Z"),
    sex: Sex.FEMALE,
    contactNumber: "09171234001",
    purok: "Purok 4",
    school: "Benguet State University",
    course: "Bachelor of Science in Information Technology",
    generalAverage: 1.75,
    purpose: "Final semester requirements submission demo",
  },
  {
    key: "jomar-bautista",
    email: "jomar.bautista@skonnect.com",
    fullName: "Jomar Bautista",
    firstName: "Jomar",
    middleName: "Reyes",
    lastName: "Bautista",
    birthDate: new Date("2002-10-12T00:00:00.000Z"),
    sex: Sex.MALE,
    contactNumber: "09171234002",
    purok: "Purok 2",
    school: "King's College of the Philippines",
    course: "Bachelor of Science in Secondary Education",
    generalAverage: 1.82,
    purpose: "Live admin review and graduation-readiness demo",
  },
] as const;

type DemoAccount = (typeof DEMO_ACCOUNTS)[number];
type DemoSupabaseClient = SupabaseClient;
type DemoSubmissionTerm = {
  semester: string;
  submittedAt: Date;
  approvedAt: Date | null;
};

function stableUuid(value: string) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function assertSeedEnabled() {
  if (process.env.SEED_GRAD_DEMO !== "true") {
    throw new Error("Set SEED_GRAD_DEMO=true to explicitly enable the graduation demo seed.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("The graduation demo seed is disabled when NODE_ENV=production.");
  }

  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!databaseUrl || !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error(
      "Set DATABASE_URL or DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and a Supabase service-role key.",
    );
  }
  const appSupabaseOrigin = new URL(supabaseUrl).origin;
  const adminSupabaseUrl = process.env.SUPABASE_URL;
  if (adminSupabaseUrl && new URL(adminSupabaseUrl).origin !== appSupabaseOrigin) {
    throw new Error(
      "SUPABASE_URL points to a different project than NEXT_PUBLIC_SUPABASE_URL. Align these URLs before seeding.",
    );
  }

  const allowedRemote = process.env.ALLOW_REMOTE_GRAD_DEMO_SEED === "true";
  const databaseHost = new URL(databaseUrl).hostname.toLowerCase();
  const supabaseHost = new URL(supabaseUrl).hostname.toLowerCase();
  const isLocalHost = (hostname: string) =>
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
  const remoteHosts = [databaseHost, supabaseHost].filter((hostname) => !isLocalHost(hostname));
  if (remoteHosts.length > 0 && !allowedRemote) {
    throw new Error(
      `Refusing to seed remote services (${remoteHosts.join(", ")}). Set ALLOW_REMOTE_GRAD_DEMO_SEED=true to explicitly allow this.`,
    );
  }
  if (remoteHosts.length > 0) {
    console.warn(
      `WARNING: This seed will modify only the two graduation demo accounts on remote services: ${remoteHosts.join(", ")}.`,
    );
  }

  return { databaseUrl, supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

async function findAuthUserByEmail(
  supabase: DemoSupabaseClient,
  email: string,
) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Could not look up demo auth user ${email}: ${error.message}`);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
}

async function ensureAuthUser(
  supabase: DemoSupabaseClient,
  account: DemoAccount,
) {
  const existing = await findAuthUserByEmail(supabase, account.email);
  if (existing) {
    const metadata = existing.user_metadata as { full_name?: unknown } | null;
    if (metadata?.full_name !== account.fullName) {
      throw new Error(
        `An unrelated Supabase account already uses ${account.email}; refusing to replace its credentials.`,
      );
    }
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: account.fullName },
    });
    if (error) throw new Error(`Could not update demo auth user ${account.email}: ${error.message}`);
    return data.user.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: account.fullName },
  });
  if (error) throw new Error(`Could not create demo auth user ${account.email}: ${error.message}`);
  if (!data.user) throw new Error(`Supabase did not return the auth user for ${account.email}.`);
  return data.user.id;
}

async function ensureGrantee(
  prisma: PrismaClient,
  account: DemoAccount,
  authId: string,
) {
  const existingUser = await prisma.user.findUnique({
    where: { email: account.email },
    select: { id: true, authId: true, kkProfileId: true, fullName: true, role: true },
  });
  const authLinkedUser = await prisma.user.findUnique({
    where: { authId },
    select: { email: true },
  });
  if (authLinkedUser && authLinkedUser.email.toLowerCase() !== account.email) {
    throw new Error(
      `The Supabase auth user for ${account.email} is linked to another Prisma account; refusing to relink it.`,
    );
  }
  if (existingUser && existingUser.authId !== authId) {
    throw new Error(
      `The Prisma account ${account.email} is linked to a different Supabase auth user; refusing to relink it.`,
    );
  }
  if (
    existingUser &&
    (existingUser.fullName !== account.fullName || existingUser.role !== Role.GRANTEE)
  ) {
    throw new Error(
      `An unrelated Prisma account already uses ${account.email}; refusing to replace its profile.`,
    );
  }

  const existingProfile = await prisma.kKProfile.findUnique({
    where: { email: account.email },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      user: { select: { id: true } },
    },
  });
  if (
    existingProfile &&
    (existingProfile.firstName !== account.firstName ||
      existingProfile.lastName !== account.lastName)
  ) {
    throw new Error(
      `An unrelated KK profile already uses ${account.email}; refusing to replace it.`,
    );
  }
  if (existingProfile?.user && existingProfile.user.id !== existingUser?.id) {
    throw new Error(
      `The KK profile for ${account.email} is linked to another Prisma user; refusing to relink it.`,
    );
  }
  if (
    existingUser?.kkProfileId &&
    existingProfile &&
    existingUser.kkProfileId !== existingProfile.id
  ) {
    throw new Error(`The demo account ${account.email} has conflicting KK profile links.`);
  }

  const profileId =
    existingUser?.kkProfileId ??
    existingProfile?.id ??
    stableUuid(`graduation-demo-profile:${account.email}`);
  const profileData = {
    firstName: account.firstName,
    middleName: account.middleName,
    lastName: account.lastName,
    fullName: account.fullName,
    purok: account.purok,
    addressLine: `${account.purok}, Barangay Pico, La Trinidad, Benguet`,
    barangay: "Pico",
    birthDate: account.birthDate,
    placeOfBirth: "La Trinidad, Benguet",
    contactNumber: account.contactNumber,
    sex: account.sex,
    email: account.email,
    isVerified: true,
  };

  return prisma.$transaction(async (transaction) => {
    const profile = await transaction.kKProfile.upsert({
      where: { email: account.email },
      create: { id: profileId, ...profileData },
      update: profileData,
    });
    const user = await transaction.user.upsert({
      where: { email: account.email },
      create: {
        authId,
        email: account.email,
        fullName: account.fullName,
        phoneNumber: account.contactNumber,
        role: Role.GRANTEE,
        kkStatus: "APPROVED",
        barangay: "Pico",
        isActive: true,
        kkProfileId: profile.id,
      },
      update: {
        authId,
        fullName: account.fullName,
        phoneNumber: account.contactNumber,
        role: Role.GRANTEE,
        kkStatus: "APPROVED",
        barangay: "Pico",
        isActive: true,
        kkProfileId: profile.id,
      },
    });
    const grantee = await transaction.grantee.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: "ACTIVE",
        yearLevel: "4th Year",
        entryAcademicYear: "2025-2026",
        entrySemester: "First Semester",
        journeyStart: "college-3",
        journeyEnd: "college-4",
        journeyStartAcademicYear: "2025-2026",
        journeyStartSemester: 1,
        journeyEndSemester: 2,
        school: account.school,
        generalAverage: account.generalAverage,
        dateEnrolled: new Date("2025-08-15T00:00:00.000Z"),
        graduationReadyAt: null,
        graduatedAt: null,
        graduatedBy: null,
        dateRemoved: null,
        exitClearanceStatus: "NONE",
      },
      update: {
        status: "ACTIVE",
        yearLevel: "4th Year",
        entryAcademicYear: "2025-2026",
        entrySemester: "First Semester",
        journeyStart: "college-3",
        journeyEnd: "college-4",
        journeyStartAcademicYear: "2025-2026",
        journeyStartSemester: 1,
        journeyEndSemester: 2,
        school: account.school,
        generalAverage: account.generalAverage,
        dateEnrolled: new Date("2025-08-15T00:00:00.000Z"),
        graduationReadyAt: null,
        graduatedAt: null,
        graduatedBy: null,
        dateRemoved: null,
        exitClearanceStatus: "NONE",
      },
    });
    return { user, grantee };
  });
}

function escapePdfText(value: string) {
  return value.replace(/[^\x20-\x7e]/g, " ").replace(/[\\()]/g, "\\$&");
}

function createPlaceholderPdf(title: string, semester: string) {
  const content = [
    "BT",
    "/F1 18 Tf",
    "50 740 Td",
    `(${escapePdfText(title)}) Tj`,
    "/F1 12 Tf",
    "0 -32 Td",
    `(${escapePdfText(semester)}) Tj`,
    "0 -28 Td",
    "(SYNTHETIC DEMO FILE - NOT AN OFFICIAL SCHOOL DOCUMENT) Tj",
    "ET",
    "",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function uploadDemoDocument(
  supabase: DemoSupabaseClient,
  account: DemoAccount,
  authId: string,
  semester: string,
  kind: "grades" | "coe",
) {
  const objectPath =
    `grantee-submissions/${authId}/graduation-demo/${account.key}/` +
    `${slug(semester)}-${kind}.pdf`;
  const title = kind === "grades" ? "Certified Grades / Grade Report" : "Certificate of Enrollment";
  const { error } = await supabase.storage
    .from(PRIVATE_DOCUMENT_BUCKET)
    .upload(objectPath, createPlaceholderPdf(title, semester), {
      contentType: "application/pdf",
      cacheControl: "3600",
      upsert: true,
    });
  if (error) {
    throw new Error(
      `Could not upload the ${kind} demo document for ${account.email} (${semester}): ${error.message}`,
    );
  }
  return `${PRIVATE_DOCUMENT_BUCKET}/${objectPath}`;
}

async function upsertDemoSubmission(
  prisma: PrismaClient,
  supabase: DemoSupabaseClient,
  account: DemoAccount,
  authId: string,
  granteeId: string,
  term: DemoSubmissionTerm,
) {
  const [gradeFileUrl, coeFileUrl] = await Promise.all([
    uploadDemoDocument(supabase, account, authId, term.semester, "grades"),
    uploadDemoDocument(supabase, account, authId, term.semester, "coe"),
  ]);
  const isApproved = term.approvedAt !== null;
  const documentStatus = isApproved ? SubmissionStatus.APPROVED : SubmissionStatus.PENDING;
  const existing = await prisma.submission.findFirst({
    where: { granteeId, semester: term.semester },
    orderBy: { submittedAt: "desc" },
    select: { id: true },
  });
  const id = existing?.id ?? stableUuid(`graduation-demo-submission:${account.email}:${term.semester}`);
  const gradeRows = [
    { subject: "Major Course", grade: "1.75", units: 3, remarks: "Passed" },
    { subject: "General Education", grade: "1.50", units: 3, remarks: "Passed" },
  ];
  const submissionData = {
    granteeId,
    semester: term.semester,
    gradeFileUrl,
    coeFileUrl,
    generalAverage: account.generalAverage,
    status: isApproved ? SubmissionStatus.APPROVED : SubmissionStatus.PENDING,
    reviewedById: null,
    reviewNotes: null,
    submittedAt: term.submittedAt,
    reviewedAt: term.approvedAt,
    physicalVerifiedBy: null,
    physicalVerifiedAt: term.approvedAt,
    flaggedFields: [],
    coeStatus: documentStatus,
    gradesStatus: documentStatus,
    coeSubmittedAt: term.submittedAt,
    coeApprovedAt: term.approvedAt,
    gradesSubmittedAt: term.submittedAt,
    gradesApprovedAt: term.approvedAt,
    gradeRows,
    gradeReportSemester: term.semester,
    ocrConfidence: isApproved ? 1 : 0.8,
    ocrGwa: account.generalAverage,
    ocrParsedRows: gradeRows,
    ocrRawText: "Synthetic graduation-demo placeholder. No official records are represented.",
    ocrStatus: isApproved ? SubmissionOcrStatus.OCR_DONE : SubmissionOcrStatus.OCR_NEEDS_REVIEW,
    ocrTotalUnits: 6,
    requiresStrictManualReview: false,
    resubmittedFields: [],
  };

  return prisma.submission.upsert({
    where: { id },
    create: { id, ...submissionData },
    update: submissionData,
  });
}

async function ensureActiveFinalTerm(prisma: PrismaClient) {
  const now = new Date();
  const activeSchedule = await prisma.academicTermSchedule.findFirst({
    where: {
      semester: FINAL_SEMESTER,
      opensAt: { lte: now },
      closesAt: { gte: now },
    },
    select: { id: true, semester: true },
  });
  if (!activeSchedule) {
    throw new Error(
      `The ${FINAL_SEMESTER} schedule must be open before seeding this demo. The script will not change global term schedules.`,
    );
  }
}

async function cleanLegacyDemoAccount(
  prisma: PrismaClient,
  supabase: DemoSupabaseClient,
  account: DemoAccount,
) {
  const legacyEmail = `${account.email.split("@")[0]}${LEGACY_DEMO_DOMAIN}`;
  const [authUser, databaseUser, profile] = await Promise.all([
    findAuthUserByEmail(supabase, legacyEmail),
    prisma.user.findUnique({
      where: { email: legacyEmail },
      select: {
        id: true,
        authId: true,
        fullName: true,
        role: true,
        kkProfileId: true,
        grantee: {
          select: { id: true, journeyStart: true, journeyEnd: true },
        },
        kkProfile: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    }),
    prisma.kKProfile.findUnique({
      where: { email: legacyEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        user: { select: { id: true } },
      },
    }),
  ]);
  if (!authUser && !databaseUser && !profile) return;

  const authName = (authUser?.user_metadata as { full_name?: unknown } | undefined)?.full_name;
  if (authUser && authName !== account.fullName) {
    throw new Error(
      `Found ${legacyEmail} in Supabase Auth, but its name does not match the seeded demo account; refusing to delete it.`,
    );
  }
  if (
    databaseUser &&
    (databaseUser.fullName !== account.fullName ||
      databaseUser.role !== Role.GRANTEE ||
      databaseUser.grantee?.journeyStart !== "college-3" ||
      databaseUser.grantee.journeyEnd !== "college-4" ||
      databaseUser.kkProfile?.firstName !== account.firstName ||
      databaseUser.kkProfile.lastName !== account.lastName)
  ) {
    throw new Error(
      `Found ${legacyEmail} in Prisma, but it does not match the seeded demo account; refusing to delete it.`,
    );
  }
  if (
    profile &&
    (profile.firstName !== account.firstName ||
      profile.lastName !== account.lastName ||
      (profile.user && profile.user.id !== databaseUser?.id))
  ) {
    throw new Error(
      `Found a KK profile for ${legacyEmail} that does not match the seeded demo account; refusing to delete it.`,
    );
  }
  if (authUser && databaseUser && authUser.id !== databaseUser.authId) {
    throw new Error(
      `The Supabase and Prisma records for ${legacyEmail} are linked to different users; refusing to delete either.`,
    );
  }

  const authId = authUser?.id ?? databaseUser?.authId;
  if (authId) {
    const legacyTerms = [...DEMO_SEMESTERS.map(({ semester }) => semester), FINAL_SEMESTER];
    const legacyPaths = legacyTerms.flatMap((semester) =>
      (["grades", "coe"] as const).map(
        (kind) =>
          `grantee-submissions/${authId}/graduation-demo/${account.key}/` +
          `${slug(semester)}-${kind}.pdf`,
      ),
    );
    const { error } = await supabase.storage
      .from(PRIVATE_DOCUMENT_BUCKET)
      .remove(legacyPaths);
    if (error) {
      throw new Error(`Could not remove legacy demo files for ${legacyEmail}: ${error.message}`);
    }
  }

  await prisma.$transaction(async (transaction) => {
    if (databaseUser) {
      await transaction.user.delete({ where: { id: databaseUser.id } });
    }
    if (profile) {
      await transaction.kKProfile.delete({ where: { id: profile.id } });
    }
  });

  if (authUser) {
    const { error } = await supabase.auth.admin.deleteUser(authUser.id);
    if (error) {
      throw new Error(`Could not remove legacy Supabase account ${legacyEmail}: ${error.message}`);
    }
  }
}

async function verifyDemoSignIns(supabaseUrl: string, anonKey: string) {
  for (const account of DEMO_ACCOUNTS) {
    const verificationClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await verificationClient.auth.signInWithPassword({
      email: account.email,
      password: DEMO_PASSWORD,
    });
    if (error) {
      throw new Error(
        `Supabase password sign-in verification failed for ${account.email}: ${error.message}`,
      );
    }
    if (data.user?.email?.toLowerCase() !== account.email) {
      throw new Error(
        `Supabase sign-in for ${account.email} returned a different account than expected.`,
      );
    }
  }
}

async function seedGraduationDemo() {
  const {
    databaseUrl,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceKey,
  } = assertSeedEnabled();
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    await ensureActiveFinalTerm(prisma);
    const { data: bucket, error: bucketError } = await supabase.storage.getBucket(PRIVATE_DOCUMENT_BUCKET);
    if (bucketError || !bucket) {
      throw new Error(
        `The ${PRIVATE_DOCUMENT_BUCKET} storage bucket must exist before seeding: ${bucketError?.message ?? "bucket not found"}`,
      );
    }

    for (const account of DEMO_ACCOUNTS) {
      await cleanLegacyDemoAccount(prisma, supabase, account);
    }

    for (const account of DEMO_ACCOUNTS) {
      const authId = await ensureAuthUser(supabase, account);
      const { user, grantee } = await ensureGrantee(prisma, account, authId);

      for (const term of DEMO_SEMESTERS) {
        await upsertDemoSubmission(
          prisma,
          supabase,
          account,
          authId,
          grantee.id,
          { ...term },
        );
      }

      if (account.key === "jomar-bautista") {
        await upsertDemoSubmission(
          prisma,
          supabase,
          account,
          authId,
          grantee.id,
          { semester: FINAL_SEMESTER, submittedAt: FINAL_SUBMITTED_AT, approvedAt: null },
        );
      }

      if (user.role !== Role.GRANTEE || !user.isActive) {
        throw new Error(`The demo account ${account.email} was not saved as an active grantee.`);
      }
    }

    await verifyDemoSignIns(supabaseUrl, supabaseAnonKey);

    console.info("\nGraduation demo accounts are ready:");
    console.table([
      {
        Email: DEMO_ACCOUNTS[0].email,
        Password: DEMO_PASSWORD,
        "Academic Journey": "3 of 4 validated; Y4 S2 open now",
        Purpose: DEMO_ACCOUNTS[0].purpose,
      },
      {
        Email: DEMO_ACCOUNTS[1].email,
        Password: DEMO_PASSWORD,
        "Academic Journey": "3 of 4 validated; Y4 S2 pending SKAdmin review",
        Purpose: DEMO_ACCOUNTS[1].purpose,
      },
    ]);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seedGraduationDemo().catch((error: unknown) => {
  console.error("Graduation demo seeding failed:", error);
  process.exitCode = 1;
});
