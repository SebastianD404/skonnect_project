import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { createClient as createSupabaseAdmin, type SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

type SupabaseAdminClient = SupabaseClient<any, "public", "public", any, any>;

async function getActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const actor = await ensureProfile(user);

  if (!actor || actor.role !== Role.SUPER_ADMIN) {
    return {
      error: NextResponse.json(
        { error: "Only SUPER_ADMIN can reconcile auth profiles." },
        { status: 403 }
      ),
    };
  }

  return { actor };
}

function deriveFullName(authUser: any) {
  const metadata = authUser.user_metadata || {};
  const fullNameFromMetadata =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    "";

  if (fullNameFromMetadata) {
    return fullNameFromMetadata.replace(/\s+/g, " ").trim();
  }

  const local = String(authUser.email || "").split("@")[0] || "";
  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\d+/g, " ")
    .trim();

  if (!cleaned) return "SK Youth";

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0][0].toUpperCase() + parts[0].slice(1);
  }

  const first = parts[0][0].toUpperCase() + parts[0].slice(1);
  const last = parts[parts.length - 1][0].toUpperCase() + parts[parts.length - 1].slice(1);
  return `${first} ${last}`;
}

async function listAllAuthUsers(supabaseAdmin: SupabaseAdminClient) {
  const users: Array<any> = [];
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

export async function POST(request: NextRequest) {
  try {
    const actorResult = await getActor();
    if ("error" in actorResult) return actorResult.error;

    const url = new URL(request.url);
    const queryApply = url.searchParams.get("apply") === "true";
    const body = await request.json().catch(() => ({}));
    const apply = body?.apply === true || queryApply;

    const adminUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    if (!adminUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.",
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin(adminUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authUsers = await listAllAuthUsers(supabaseAdmin);
    let skippedNoEmail = 0;
    let alreadyLinked = 0;
    let wouldRelink = 0;
    let wouldCreate = 0;
    let relinked = 0;
    let created = 0;
    let errors = 0;

    for (const authUser of authUsers) {
      const authId = authUser.id;
      const email = String(authUser.email || "").trim();
      if (!authId || !email) {
        skippedNoEmail += 1;
        continue;
      }

      try {
        const byAuthId = await prisma.user.findUnique({
          where: { authId },
          select: { id: true },
        });

        if (byAuthId) {
          alreadyLinked += 1;
          continue;
        }

        const existingByEmail = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true, authId: true },
        });

        if (existingByEmail) {
          wouldRelink += 1;
          if (apply) {
            await prisma.user.update({
              where: { id: existingByEmail.id },
              data: { authId },
            });
            relinked += 1;
          }
          continue;
        }

        wouldCreate += 1;
        if (apply) {
          await prisma.user.create({
            data: {
              authId,
              email,
              fullName: deriveFullName(authUser),
              role: "YOUTH",
            },
          });
          created += 1;
        }
      } catch (error) {
        errors += 1;
        console.error("Reconcile error for user", email, error);
      }
    }

    return NextResponse.json({
      summary: {
        totalAuthUsers: authUsers.length,
        skippedNoEmail,
        alreadyLinked,
        wouldRelink,
        wouldCreate,
        relinked: apply ? relinked : 0,
        created: apply ? created : 0,
        errors,
      },
      applied: apply,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reconcile auth users.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
