#!/usr/bin/env node

const dotenv = require("dotenv");
dotenv.config();
dotenv.config({ path: ".env.local", override: false });

const { createClient } = require("@supabase/supabase-js");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { PrismaClient } = require("@prisma/client");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables.");
  console.error("Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("Missing required database connection variable.");
  console.error("Required: DATABASE_URL or DIRECT_URL");
  process.exit(1);
}

const isApplyMode = process.argv.includes("--apply");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const prismaPool = new Pool({ connectionString: DATABASE_URL });
const prismaAdapter = new PrismaPg(prismaPool);
const prisma = new PrismaClient({ adapter: prismaAdapter });

function toTitleCase(value) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function deriveDisplayNameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\d+/g, " ")
    .trim();

  if (!cleaned) return "SK Youth";

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return toTitleCase(parts[0]);

  return `${toTitleCase(parts[0])} ${toTitleCase(parts[parts.length - 1])}`;
}

function resolveFullName(authUser) {
  const metadata = authUser.user_metadata || {};
  const fullNameFromMetadata =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    "";

  if (fullNameFromMetadata) {
    return fullNameFromMetadata.replace(/\s+/g, " ").trim();
  }

  return deriveDisplayNameFromEmail(authUser.email || "");
}

async function listAllAuthUsers() {
  const users = [];
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data?.users || [];
    users.push(...batch);

    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function reconcile() {
  console.log(`Mode: ${isApplyMode ? "APPLY" : "DRY RUN"}`);
  console.log("Loading auth users from Supabase...");

  const authUsers = await listAllAuthUsers();
  console.log(`Found ${authUsers.length} auth users.`);

  let skippedNoEmail = 0;
  let unchanged = 0;
  let willCreate = 0;
  let willRelink = 0;
  let errors = 0;

  for (const authUser of authUsers) {
    const authId = authUser.id;
    const email = (authUser.email || "").trim();

    if (!authId || !email) {
      skippedNoEmail += 1;
      continue;
    }

    try {
      const byAuthId = await prisma.user.findUnique({
        where: { authId },
        select: { id: true, email: true },
      });

      if (byAuthId) {
        unchanged += 1;
        continue;
      }

      const byEmail = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, authId: true, email: true },
      });

      if (byEmail) {
        willRelink += 1;

        if (isApplyMode) {
          await prisma.user.update({
            where: { id: byEmail.id },
            data: { authId, email },
          });
        }

        continue;
      }

      willCreate += 1;

      if (isApplyMode) {
        await prisma.user.create({
          data: {
            authId,
            email,
            fullName: resolveFullName(authUser),
            role: "YOUTH",
          },
        });
      }
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to reconcile ${email}: ${message}`);
    }
  }

  console.log("\nSummary");
  console.log(`- Skipped (no email): ${skippedNoEmail}`);
  console.log(`- Unchanged (already linked by authId): ${unchanged}`);
  console.log(`- ${isApplyMode ? "Relinked" : "Would relink"} by email: ${willRelink}`);
  console.log(`- ${isApplyMode ? "Created" : "Would create"} profiles: ${willCreate}`);
  console.log(`- Errors: ${errors}`);

  if (!isApplyMode) {
    console.log("\nDry run only. Re-run with --apply to persist changes.");
  }
}

reconcile()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fatal error: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await prismaPool.end();
  });
