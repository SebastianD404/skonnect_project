import { GranteeStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  buildExitClearanceReturnedEmail,
  createGmailTransporter,
  getSkeapDashboardUrl,
  sendTransactionalEmail,
} from "@/lib/broadcast-email";
import {
  getPrivateDocumentPath,
  PRIVATE_DOCUMENT_BUCKET,
} from "@/lib/private-documents";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasGranteeColumn, prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "jpg" || extension === "jpeg" || extension === "jfif") {
    return "image/jpeg";
  }
  return "application/octet-stream";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing grantee id." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const activeProfile = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { isActive: true },
  });
  if (!activeProfile?.isActive) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const hasFileNameColumn = await hasGranteeColumn("exitClearanceFileName");
  const grantee = await prisma.grantee.findUnique({
    where: { id },
    select: {
      exitClearanceUrl: true,
      ...(hasFileNameColumn ? { exitClearanceFileName: true } : {}),
      user: { select: { authId: true } },
    },
  });
  if (!grantee?.exitClearanceUrl) {
    return NextResponse.json({ error: "No exit-clearance document is attached to this record." }, { status: 404 });
  }

  const fileName =
    "exitClearanceFileName" in grantee && grantee.exitClearanceFileName
      ? grantee.exitClearanceFileName
      : grantee.exitClearanceUrl.split("/").pop() || "Exit clearance";
  const objectPath =
    getPrivateDocumentPath(grantee.exitClearanceUrl) ??
    (grantee.exitClearanceUrl.startsWith("grantee-clearances/")
      ? grantee.exitClearanceUrl
      : null);
  const ownerPrefix = `grantee-clearances/${grantee.user.authId}/`;
  if (
    !objectPath ||
    !objectPath.startsWith(ownerPrefix) ||
    objectPath.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    console.error("Stored exit-clearance path is invalid or does not belong to the scholar.", {
      granteeId: id,
    });
    return NextResponse.json(
      { error: "Unable to generate a secure preview link for this document." },
      { status: 500 },
    );
  }

  const { data, error } = await createAdminClient()
    .storage.from(PRIVATE_DOCUMENT_BUCKET)
    .createSignedUrl(objectPath, 60);
  if (error || !data?.signedUrl) {
    console.error(
      "Could not create an exit-clearance preview URL.",
      error ?? new Error("Supabase Storage returned no signed URL."),
    );
    return NextResponse.json(
      { error: "Unable to generate a secure preview link for this document." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      signedUrl: data.signedUrl,
      fileName,
      mimeType: getMimeType(fileName),
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing grantee id." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const activeProfile = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { isActive: true },
  });
  if (!activeProfile?.isActive) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let remarks: string;
  try {
    const body = await request.json() as { remarks?: unknown };
    remarks = typeof body.remarks === "string" ? body.remarks.trim() : "";
  } catch {
    return NextResponse.json({ error: "Provide a reason for returning this clearance." }, { status: 400 });
  }
  if (!remarks || remarks.length > 1000) {
    return NextResponse.json(
      { error: "Clearance Notes must include a reason of 1,000 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const returnedGrantee = await prisma.$transaction(async (tx) => {
      const grantee = await tx.grantee.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          status: true,
          exitClearanceStatus: true,
          exitClearanceUrl: true,
          graduationRemarks: true,
          user: { select: { fullName: true, email: true } },
        },
      });
      if (!grantee) throw new Error("GRANTEE_NOT_FOUND");
      if (
        (grantee.status !== GranteeStatus.ACTIVE && grantee.status !== GranteeStatus.PROBATIONARY) ||
        grantee.exitClearanceStatus === "CLEARED" ||
        !grantee.exitClearanceUrl
      ) {
        throw new Error("EXIT_CLEARANCE_NOT_PENDING");
      }

      const updated = await tx.grantee.updateMany({
        where: {
          id,
          status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
          exitClearanceStatus: grantee.exitClearanceStatus,
          exitClearanceUrl: grantee.exitClearanceUrl,
        },
        data: {
          exitClearanceStatus: "RETURNED",
          graduationRemarks: remarks,
        },
      });
      if (updated.count !== 1) throw new Error("EXIT_CLEARANCE_NOT_PENDING");

      const subject = "Action Required: Re-upload Your SKEAP Exit Clearance";
      const message = [
        "Your SKEAP Exit Clearance was returned for re-upload. Please upload a clearer copy to continue graduation verification.",
        `Reason from SK Admin:\n${remarks}`,
      ].join("\n\n");
      const sourceKey = `exit-clearance-returned:${grantee.id}:${new Date().toISOString()}`;
      const granteeMessage = await tx.granteeMessage.create({
        data: {
          userId: grantee.userId,
          senderId: admin.id,
          subject,
          body: message,
        },
        select: { id: true },
      });
      await tx.notification.create({
        data: {
          userId: grantee.userId,
          sourceKey,
          message: `${subject}\n\n${message}`,
        },
      });
      await writeAuditLog(tx, {
        action: "EXIT_CLEARANCE_RETURNED",
        actorId: admin.id,
        targetTable: "grantees",
        targetId: grantee.id,
        beforeData: {
          exitClearanceStatus: grantee.exitClearanceStatus,
          graduationRemarks: grantee.graduationRemarks,
        },
        afterData: {
          exitClearanceStatus: "RETURNED",
          graduationRemarks: remarks,
        },
        metadata: { granteeName: grantee.user.fullName, messageId: granteeMessage.id },
      });

      return {
        id: grantee.id,
        userId: grantee.userId,
        fullName: grantee.user.fullName,
        email: grantee.user.email,
      };
    });

    if (returnedGrantee.email?.trim()) {
      try {
        const email = buildExitClearanceReturnedEmail({
          granteeFullName: returnedGrantee.fullName,
          remarks,
          dashboardUrl: getSkeapDashboardUrl(),
        });
        await sendTransactionalEmail(
          createGmailTransporter(),
          returnedGrantee.email,
          email.subject,
          email.text,
          `exit-clearance-returned-${returnedGrantee.id}-${Date.now()}`,
          email.html,
        );
      } catch (emailError) {
        console.error("Exit clearance was returned, but email notification failed.", {
          granteeId: returnedGrantee.id,
          userId: returnedGrantee.userId,
          error: emailError,
        });
      }
    } else {
      console.error("Exit-clearance return email was not sent because the grantee has no registered email address.", {
        granteeId: returnedGrantee.id,
        userId: returnedGrantee.userId,
      });
    }

    revalidatePath("/admin/exit-clearances");
    revalidatePath("/admin/grantees");
    revalidatePath("/admin/grantees/records");
    revalidatePath("/grantee-dashboard");
    return NextResponse.json({ success: true, exitClearanceStatus: "RETURNED" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to return exit clearance.";
    if (message === "GRANTEE_NOT_FOUND") {
      return NextResponse.json({ error: "Grantee not found." }, { status: 404 });
    }
    if (message === "EXIT_CLEARANCE_NOT_PENDING") {
      return NextResponse.json(
        { error: "Only an uploaded clearance on an active grantee can be returned for re-upload." },
        { status: 409 },
      );
    }
    console.error("Failed to return grantee exit clearance:", error);
    return NextResponse.json({ error: "Unable to return exit clearance right now." }, { status: 500 });
  }
}
