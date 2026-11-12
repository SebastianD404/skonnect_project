import "dotenv/config";
import { randomUUID } from "node:crypto";
import { fakerEN } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, SubmissionStatus } from "@prisma/client";
import { Pool } from "pg";
import { PICO_SITIOS } from "../lib/barangay-sitios";
import { getSkeapCapacityCount, getSkeapMaxSlots, lockSkeapCapacity } from "../lib/skeap-capacity";

const DEMO_EMAIL_SUFFIX = "@demo.skonnect.invalid";
const DEMO_SEED = 20261112;
const ACTIVE_SCHOLAR_COUNT = 55;

const FIRST_NAMES = [
  "Maria", "Jose", "Juan", "Ana", "Rosa", "Angelo", "Gabriel", "Sofia",
  "Miguel", "Andrea", "Lourdes", "Paolo", "Daniel", "Catherine", "Mark",
  "Jasmine", "Rafael", "Isabella", "Francis", "Nicole", "Carlo", "Christine",
  "Emmanuel", "Beatriz", "Noel", "Joy", "Samuel", "Patricia", "Arnel", "Leah",
];
const MIDDLE_NAMES = [
  "Santos", "Reyes", "Cruz", "Bautista", "Mendoza", "Dela Cruz", "Garcia",
  "Villanueva", "Ramos", "Aquino", "Flores", "Castillo",
];
const LAST_NAMES = [
  "Dela Cruz", "Santos", "Reyes", "Cruz", "Bautista", "Mendoza", "Garcia",
  "Villanueva", "Ramos", "Aquino", "Flores", "Castillo", "Domingo", "Aguilar",
  "Fernandez", "Manalo", "Navarro", "Salazar", "Valdez", "Dizon",
];
const SCHOOLS = [
  "Benguet State University",
  "University of the Cordilleras",
  "Cordillera Career Development College",
  "La Trinidad National High School",
];
const COURSES = [
  "Bachelor of Science in Information Technology",
  "Bachelor of Science in Education",
  "Bachelor of Science in Agriculture",
  "Bachelor of Science in Nursing",
  "Bachelor of Science in Business Administration",
];
const GRADES = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const DEMO_YEAR_LEVELS = ["15-17", "18-24", "25-30"];

function assertSafeLocalSeedTarget() {
  if (process.env.SEED_DEMO_DATA !== "true") {
    throw new Error("Set SEED_DEMO_DATA=true to explicitly enable synthetic demo records.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seeding is disabled when NODE_ENV=production.");
  }

  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Set DATABASE_URL or DIRECT_URL to a database.");

  const hostname = new URL(databaseUrl).hostname.toLowerCase();
  const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
  if (!isLocal) {
    if (process.env.ALLOW_REMOTE_SEED !== "true") {
      throw new Error(
        `Refusing to seed remote database host "${hostname}". Set ALLOW_REMOTE_SEED=true to explicitly allow remote seeding.`,
      );
    }

    console.warn(
      `\u001b[93mWARNING: Seeding remote database host "${hostname}". Synthetic demo records will be written.\u001b[0m`,
    );
  }
}

function randomDateOfBirth(age: number) {
  const now = new Date();
  return new Date(
    now.getFullYear() - age,
    fakerEN.number.int({ min: 0, max: 11 }),
    fakerEN.number.int({ min: 1, max: 28 }),
  );
}

export function generateDemoRecords(activeScholarSlots = ACTIVE_SCHOLAR_COUNT) {
  fakerEN.seed(DEMO_SEED);
  const activeScholarCount = Number.isFinite(activeScholarSlots)
    ? Math.max(0, Math.min(ACTIVE_SCHOLAR_COUNT, Math.floor(activeScholarSlots)))
    : 0;
  const cohorts = fakerEN.helpers.shuffle([
    ...Array.from({ length: 800 }, () => "KK_ONLY" as const),
    ...Array.from({ length: activeScholarCount }, () => "ACTIVE_SCHOLAR" as const),
    ...Array.from({ length: 100 - activeScholarCount }, () => "WAITLISTED" as const),
    ...Array.from({ length: 100 }, () => "PENDING_APPLICATION" as const),
  ]);
  const now = new Date();

  return cohorts.map((cohort, index) => {
    const firstName = fakerEN.helpers.arrayElement(FIRST_NAMES);
    const middleName = fakerEN.helpers.arrayElement(MIDDLE_NAMES);
    const lastName = fakerEN.helpers.arrayElement(LAST_NAMES);
    const fullName = `${firstName} ${middleName} ${lastName}`;
    const email = `demo-youth-${String(index + 1).padStart(4, "0")}${DEMO_EMAIL_SUFFIX}`;
    const age = fakerEN.number.int({ min: 15, max: 30 });
    const birthDate = randomDateOfBirth(age);
    const sitio = fakerEN.helpers.arrayElement(PICO_SITIOS);
    const sex = fakerEN.helpers.arrayElement(["Female", "Male"]);
    const contactNumber = `09${fakerEN.string.numeric(9)}`;
    const id = randomUUID();
    const kkProfileId = randomUUID();
    const authId = randomUUID();

    return {
      cohort,
      id,
      authId,
      kkProfileId,
      email,
      firstName,
      middleName,
      lastName,
      fullName,
      age,
      birthDate,
      sitio,
      sex,
      contactNumber,
      createdAt: now,
      updatedAt: now,
    };
  });
}

async function seed() {
  assertSafeLocalSeedTarget();
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Local database connection string is unavailable.");

  const pool = new Pool({ connectionString, max: 5 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const seedResult = await prisma.$transaction(async (tx) => {
      await lockSkeapCapacity(tx);
      const maxSlots = await getSkeapMaxSlots(tx);
      const existing = await tx.user.findMany({
        where: { email: { endsWith: DEMO_EMAIL_SUFFIX } },
        select: { id: true, kkProfileId: true },
      });
      const existingUserIds = existing.map(({ id }) => id);
      const existingProfileIds = existing
        .map(({ kkProfileId }) => kkProfileId)
        .filter((id): id is string => Boolean(id));
      if (existingUserIds.length > 0) {
        await tx.skeapApplication.deleteMany({ where: { userId: { in: existingUserIds } } });
        await tx.profilingRegistration.deleteMany({ where: { userId: { in: existingUserIds } } });
        await tx.grantee.deleteMany({ where: { userId: { in: existingUserIds } } });
        await tx.user.deleteMany({ where: { id: { in: existingUserIds } } });
      }
      if (existingProfileIds.length > 0) {
        await tx.kKProfile.deleteMany({ where: { id: { in: existingProfileIds } } });
      }

      const currentCapacity = await getSkeapCapacityCount(tx);
      const availableSlots = Math.max(0, maxSlots - currentCapacity);
      const records = generateDemoRecords(availableSlots);

      await tx.kKProfile.createMany({
        data: records.map((record) => ({
          id: record.kkProfileId,
          firstName: record.firstName,
          middleName: record.middleName,
          lastName: record.lastName,
          fullName: record.fullName,
          purok: record.sitio,
          addressLine: `Barangay Pico, La Trinidad, Benguet`,
          barangay: "Pico",
          birthDate: record.birthDate,
          contactNumber: record.contactNumber,
          email: record.email,
          isVerified: true,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })),
      });

      await tx.user.createMany({
        data: records.map((record) => ({
          id: record.id,
          authId: record.authId,
          kkProfileId: record.kkProfileId,
          email: record.email,
          fullName: record.fullName,
          phoneNumber: record.contactNumber,
          role: record.cohort === "ACTIVE_SCHOLAR" ? Role.GRANTEE : Role.YOUTH,
          kkStatus: "APPROVED",
          barangay: "Pico",
          isActive: true,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })),
      });

      await tx.profilingRegistration.createMany({
        data: records.map((record) => ({
          id: randomUUID(),
          userId: record.id,
          fullName: record.fullName,
          address: `${record.sitio}, Pico, La Trinidad, Benguet`,
          sex: record.sex,
          age: record.age,
          birthDate: record.birthDate,
          email: record.email,
          facebook: `https://example.invalid/demo-youth-${record.id}`,
          contactNumber: record.contactNumber,
          civilStatus: "Single",
          youthClassification: fakerEN.helpers.arrayElement(["In School Youth", "Out of School Youth"]),
          youthAgeGroup: record.age < 18 ? DEMO_YEAR_LEVELS[0] : record.age < 25 ? DEMO_YEAR_LEVELS[1] : DEMO_YEAR_LEVELS[2],
          workStatus: fakerEN.helpers.arrayElement(["Student", "Unemployed", "Employed"]),
          educationalBackground: fakerEN.helpers.arrayElement(["High School", "Senior High School", "College"]),
          registeredSKVoter: fakerEN.helpers.arrayElement(["Yes", "No"]),
          votedLastSK: fakerEN.helpers.arrayElement(["Yes", "No"]),
          registeredNationalVoter: fakerEN.helpers.arrayElement(["Yes", "No"]),
          attendedKKAssembly: fakerEN.helpers.arrayElement(["Yes", "No"]),
          consent: true,
          reviewStatus: "Approved",
          submittedAt: record.createdAt,
          middleName: record.middleName,
        })),
      });

      const activeScholarRecords = records.filter((record) => record.cohort === "ACTIVE_SCHOLAR");
      if (activeScholarRecords.length > 0) {
        await tx.grantee.createMany({
          data: activeScholarRecords.map((record) => ({
            id: randomUUID(),
            userId: record.id,
            status: "ACTIVE",
            yearLevel: fakerEN.helpers.arrayElement(GRADES),
            school: fakerEN.helpers.arrayElement(SCHOOLS),
            generalAverage: fakerEN.number.float({ min: 85, max: 97, fractionDigits: 2 }),
            dateEnrolled: record.createdAt,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          })),
        });
      }

      const applicationRecords = records.filter((record) => record.cohort !== "KK_ONLY");
      await tx.skeapApplication.createMany({
        data: applicationRecords.map((record) => ({
          id: randomUUID(),
          userId: record.id,
          applicantName: record.fullName,
          currentCourse: fakerEN.helpers.arrayElement(COURSES),
          yearLevel: fakerEN.helpers.arrayElement(GRADES),
          school: fakerEN.helpers.arrayElement(SCHOOLS),
          permanentAddress: `${record.sitio}, Pico, La Trinidad, Benguet`,
          dateOfBirth: record.birthDate,
          age: record.age,
          contactNumber: record.contactNumber,
          emailAddress: record.email,
          status: record.cohort === "ACTIVE_SCHOLAR"
            ? SubmissionStatus.APPROVED
            : record.cohort === "WAITLISTED"
              ? SubmissionStatus.WAITLISTED
              : SubmissionStatus.PENDING,
          enrollmentFileUrl: `https://example.invalid/demo-documents/${record.id}/enrollment`,
          reportCardFileUrl: `https://example.invalid/demo-documents/${record.id}/grades`,
          uploadedFiles: [],
          submittedAt: record.createdAt,
          updatedAt: record.updatedAt,
        })),
      });

      const activeScholarUserIds = activeScholarRecords.map((record) => record.id);
      const createdActiveScholarCount = await tx.grantee.count({
        where: {
          userId: { in: activeScholarUserIds },
          status: "ACTIVE",
        },
      });
      if (createdActiveScholarCount !== availableSlots) {
        throw new Error(
          `Expected ${availableSlots} active synthetic scholars, created ${createdActiveScholarCount}.`,
        );
      }

      const finalCapacity = await getSkeapCapacityCount(tx);
      const expectedCapacity = Math.max(currentCapacity, maxSlots);
      if (finalCapacity !== expectedCapacity) {
        throw new Error(
          `Expected total SKEAP capacity usage to be ${expectedCapacity}, found ${finalCapacity}.`,
        );
      }

      return {
        records,
        activeScholarCount: createdActiveScholarCount,
        waitlistedCount: records.filter((record) => record.cohort === "WAITLISTED").length,
        currentCapacity,
        maxSlots,
        removedDemoUsers: existingUserIds.length,
      };
    }, { timeout: 60_000 });

    console.info(`Removed ${seedResult.removedDemoUsers} previous synthetic demo users before rebuilding.`);
    console.info(`Existing SKEAP capacity before seeding: ${seedResult.currentCapacity}/${seedResult.maxSlots}.`);
    console.info(
      `Created ${seedResult.records.length} synthetic demo youth records: 800 KK-only, ${seedResult.activeScholarCount} active scholars, ${seedResult.waitlistedCount} waitlisted, 100 pending applications.`,
    );
    console.info(`All generated emails end in ${DEMO_EMAIL_SUFFIX}; these accounts cannot sign in.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  seed().catch((error: unknown) => {
    console.error("Synthetic demo seeding failed:", error);
    process.exitCode = 1;
  });
}
