import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRIVATE_DOCUMENT_BUCKET } from "@/lib/private-documents";
import { SKEAP_REVOCATION_PROOF_BUCKET } from "@/lib/skeap-revocation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing grantee id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const activeProfile = await prisma.user.findUnique({
    where: { id: appUser.id },
    select: { isActive: true },
  });
  if (!activeProfile?.isActive) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const grantee = await prisma.grantee.findUnique({
    where: { id },
    select: {
      id: true,
      revocationProofPath: true,
      revocationProofFileName: true,
      revocationProofType: true,
      revocationProofHash: true,
      revocationProofMimeType: true,
    },
  });
  if (!grantee?.revocationProofPath) {
    return NextResponse.json(
      { error: "No supporting proof document is attached to this record." },
      { status: 404 },
    );
  }
  const objectPath = grantee.revocationProofPath.replace(/^revocation-proofs\//, "");
  if (
    !objectPath.startsWith(`${id}/`) ||
    objectPath.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    console.error("Stored SKEAP revocation proof path is invalid", { granteeId: id });
    return NextResponse.json({ error: "Unable to generate secure preview link for this document." }, { status: 500 });
  }

  const supabaseAdmin = createAdminClient();
  let { data, error } = await supabaseAdmin.storage
    .from(SKEAP_REVOCATION_PROOF_BUCKET)
    .createSignedUrl(objectPath, 60);
  if ((error || !data?.signedUrl) && objectPath !== grantee.revocationProofPath) {
    const prefixedResult = await supabaseAdmin.storage
      .from(SKEAP_REVOCATION_PROOF_BUCKET)
      .createSignedUrl(grantee.revocationProofPath, 60);
    data = prefixedResult.data;
    error = prefixedResult.error;
  }
  if (error || !data?.signedUrl) {
    const legacyResult = await supabaseAdmin.storage
      .from(PRIVATE_DOCUMENT_BUCKET)
      .createSignedUrl(grantee.revocationProofPath, 60);
    data = legacyResult.data;
    error = legacyResult.error;
  }
  if (error || !data?.signedUrl) {
    console.error(
      "Could not create SKEAP revocation proof URL",
      error ?? new Error("Supabase Storage returned no signed URL."),
    );
    return NextResponse.json(
      { error: "Unable to generate secure preview link for this document." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      signedUrl: data.signedUrl,
      fileName: grantee.revocationProofFileName,
      proofType: grantee.revocationProofType,
      proofHash: grantee.revocationProofHash,
      mimeType: grantee.revocationProofMimeType,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
