import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

function getArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

const currentEmail = getArgument("--current-email")?.toLowerCase();
const newEmail = getArgument("--new-email")?.toLowerCase();
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!currentEmail || !newEmail || !supabaseUrl || !serviceRoleKey || !databaseUrl) {
  throw new Error(
    "Usage: npx tsx scripts/repair-auth-email.ts --current-email old@example.com --new-email new@example.com. Set SUPABASE_SERVICE_ROLE_KEY in the server environment."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const profile = await prisma.user.findFirst({
    where: { email: { equals: currentEmail, mode: "insensitive" } },
    select: { id: true, authId: true, email: true },
  });

  if (!profile?.authId) {
    throw new Error(`No linked profile found for ${currentEmail}.`);
  }

  const owner = await prisma.user.findFirst({
    where: {
      email: { equals: newEmail, mode: "insensitive" },
      NOT: { id: profile.id },
    },
    select: { id: true },
  });

  if (owner) {
    throw new Error(`The new email is already linked to another account.`);
  }

  const { data, error } = await supabase.auth.admin.updateUserById(profile.authId, {
    email: newEmail,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(error?.message || "Supabase Auth did not return the updated user.");
  }

  await prisma.user.update({
    where: { id: profile.id },
    data: { email: newEmail },
  });

  console.log(`Repaired authenticated email for profile ${profile.id}: ${newEmail}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
