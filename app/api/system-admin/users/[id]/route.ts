import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";

type StoragePrefix = { bucket: string; path: string };

async function listStorageObjects(
  storage: ReturnType<typeof createAdminClient>["storage"],
  bucket: string,
  prefix: string,
) {
  const files: string[] = [];
  const directories = [prefix];
  const pageSize = 1000;

  while (directories.length > 0) {
    const directory = directories.pop();
    if (!directory) continue;

    let offset = 0;
    while (true) {
      const { data, error } = await storage.from(bucket).list(directory, {
        limit: pageSize,
        offset,
      });
      if (error) throw error;

      for (const entry of data ?? []) {
        const path = `${directory}/${entry.name}`;
        if (entry.id === null) {
          directories.push(path);
        } else {
          files.push(path);
        }
      }

      if (!data || data.length < pageSize) break;
      offset += pageSize;
    }
  }

  return files;
}

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
        { error: "Only SUPER_ADMIN can manage users." },
        { status: 403 }
      ),
    };
  }

  return { actor };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actorResult = await getActor();
    if ("error" in actorResult) return actorResult.error;
    const { actor } = actorResult;

    const { id } = await params;
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, email: true, phoneNumber: true, role: true, isActive: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const body = await request.json();
    const nextFullName =
      typeof body?.fullName === "string" ? body.fullName.trim() : undefined;
    const nextEmail = typeof body?.email === "string" ? body.email.trim() : undefined;
    const nextPhoneNumber =
      typeof body?.phoneNumber === "string"
        ? body.phoneNumber.trim() || null
        : undefined;
    const nextIsActive =
      typeof body?.isActive === "boolean" ? body.isActive : undefined;

    if (
      typeof nextFullName === "undefined" &&
      typeof nextEmail === "undefined" &&
      typeof nextPhoneNumber === "undefined" &&
      typeof nextIsActive === "undefined"
    ) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    if (typeof nextFullName !== "undefined" && nextFullName.length < 2) {
      return NextResponse.json(
        { error: "Full name must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (
      typeof nextEmail !== "undefined" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)
    ) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }

    if (target.id === actor.id && nextIsActive === false) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 }
      );
    }

    if (typeof nextPhoneNumber === "string" && nextPhoneNumber.length > 32) {
      return NextResponse.json(
        { error: "Phone number must be 32 characters or fewer." },
        { status: 400 }
      );
    }

    const existingUserWithEmail =
      typeof nextEmail !== "undefined"
        ? await prisma.user.findFirst({
            where: {
              email: nextEmail,
              NOT: { id: target.id },
            },
            select: { id: true },
          })
        : null;

    if (existingUserWithEmail) {
      return NextResponse.json(
        { error: "Email is already used by another account." },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: target.id },
        data: {
          ...(typeof nextFullName !== "undefined" ? { fullName: nextFullName } : {}),
          ...(typeof nextEmail !== "undefined" ? { email: nextEmail } : {}),
          ...(typeof nextPhoneNumber !== "undefined" ? { phoneNumber: nextPhoneNumber } : {}),
          ...(typeof nextIsActive !== "undefined" ? { isActive: nextIsActive } : {}),
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await writeAuditLog(tx, {
        action: typeof nextIsActive === "boolean" ? "UPDATE_USER_STATUS" : "UPDATE_USER_PROFILE",
        actorId: actor.id,
        targetTable: "users",
        targetId: target.id,
        beforeData: {
          fullName: target.fullName,
          email: target.email,
          phoneNumber: target.phoneNumber,
          role: target.role,
          isActive: target.isActive,
        },
        afterData: {
          fullName: nextUser.fullName,
          email: nextUser.email,
          phoneNumber: nextUser.phoneNumber,
          role: nextUser.role,
          isActive: nextUser.isActive,
        },
      });

      return nextUser;
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let authAccountDeleted = false;
  try {
    const actorResult = await getActor();
    if ("error" in actorResult) return actorResult.error;
    const { actor } = actorResult;

    const { id } = await params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, authId: true, fullName: true, email: true, role: true, isActive: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (target.id === actor.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    const authoredAnnouncements = await prisma.announcement.count({
      where: { authorId: target.id },
    });
    if (authoredAnnouncements > 0) {
      return NextResponse.json(
        {
          error:
            "This account authored announcements. Reassign or remove those announcements before deleting the account.",
        },
        { status: 409 }
      );
    }

    const { error: authDeleteError } = await createAdminClient().auth.admin.deleteUser(target.authId);
    if (authDeleteError && authDeleteError.status !== 404) {
      return NextResponse.json(
        { error: `Could not delete the Supabase sign-in account: ${authDeleteError.message}` },
        { status: 502 }
      );
    }
    authAccountDeleted = true;

    const storage = createAdminClient().storage;
    const storagePrefixes: StoragePrefix[] = [
      { bucket: "avatars", path: `avatars/${target.authId}` },
      { bucket: "grantee-submissions", path: `grantee-submissions/${target.authId}` },
      { bucket: "public image", path: `skeap-applications/${target.authId}` },
      { bucket: "public image", path: `kk-verification/${target.authId}` },
    ];
    for (const { bucket, path } of storagePrefixes) {
      const files = await listStorageObjects(storage, bucket, path);
      for (let index = 0; index < files.length; index += 100) {
        const { error: storageDeleteError } = await storage
          .from(bucket)
          .remove(files.slice(index, index + 100));
        if (storageDeleteError) throw storageDeleteError;
      }
    }

    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        action: "DELETE_USER",
        actorId: actor.id,
        targetTable: "users",
        targetId: target.id,
        beforeData: {
          fullName: target.fullName,
          email: target.email,
          role: target.role,
          isActive: target.isActive,
        },
        afterData: Prisma.JsonNull,
      });

      await tx.auditLog.deleteMany({ where: { actorId: target.id } });
      await tx.user.delete({ where: { id: target.id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete user. This user may have related records.";
    if (authAccountDeleted) {
      console.error("Supabase Auth user deleted but SKonnect profile cleanup failed:", error);
      return NextResponse.json(
        {
          error:
            "The Supabase sign-in account was deleted, but some stored files or the SKonnect profile could not be fully removed. Retry the deletion or contact support.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
