import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit/logger";
import { getOcrAdminActor } from "@/lib/ocr/admin-access";
import {
  getLegacySubmissionStorageObject,
  getSubmissionStorageObject,
} from "@/lib/ocr/storage";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type SubmissionFileObject = {
  bucket: string;
  path: string;
};

function getSubmissionFileObject(filePath: string, authId: string): SubmissionFileObject {
  const privatePrefix = `grantee-submissions/${authId}/`;
  return filePath.startsWith(privatePrefix)
    ? getSubmissionStorageObject(filePath, authId)
    : getLegacySubmissionStorageObject(filePath, authId);
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { actor, error, status } = await getOcrAdminActor();
    if (!actor) {
      return NextResponse.json({ error }, { status: status ?? 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Submission id is required." }, { status: 400 });
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        semester: true,
        submittedAt: true,
        gradeFileUrl: true,
        coeFileUrl: true,
        granteeId: true,
        grantee: { select: { user: { select: { authId: true } } } },
      },
    });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    const fileObjects = [submission.coeFileUrl, submission.gradeFileUrl]
      .filter(Boolean)
      .map((filePath) => getSubmissionFileObject(filePath, submission.grantee.user.authId));
    const objectsByBucket = new Map<string, Set<string>>();
    for (const object of fileObjects) {
      const paths = objectsByBucket.get(object.bucket) ?? new Set<string>();
      paths.add(object.path);
      objectsByBucket.set(object.bucket, paths);
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.submission.delete({ where: { id } });
      await writeAuditLog(transaction, {
        action: "SUBMISSION_DELETED",
        actorId: actor.id,
        targetTable: "submissions",
        targetId: id,
        beforeData: {
          granteeId: submission.granteeId,
          semester: submission.semester,
          submittedAt: submission.submittedAt.toISOString(),
        },
      });
    });

    try {
      const storage = createAdminClient().storage;
      for (const [bucket, paths] of objectsByBucket) {
        const { error: storageError } = await storage.from(bucket).remove([...paths]);
        if (storageError) throw storageError;
      }
    } catch (storageError) {
      console.error("Submission record deleted but uploaded-file cleanup failed:", {
        submissionId: id,
        error: storageError,
      });
      return NextResponse.json({
        success: true,
        warning: "The submission was deleted, but one or more uploaded files could not be removed.",
      });
    }

    return NextResponse.json({ success: true });
  } catch (caughtError) {
    console.error("Could not delete submission:", caughtError);
    const message = caughtError instanceof Error ? caughtError.message : "Could not delete submission.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
