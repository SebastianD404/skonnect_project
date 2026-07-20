import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  BARANGAY_PICO,
  OFFICIAL_PUROKS,
  OFFICIAL_SITIOS,
  isOfficialSitio,
  buildTemporaryPassword,
  isOfficialPurok,
  normalizeSitio,
  normalizePurok,
  splitFullName,
} from "@/lib/kk";

function isBarangayPico(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  return normalized === "pico" || normalized === "barangay pico" || normalized === "brgy pico";
}

function computeAge(birthDate: Date) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();

  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  let age = currentYear - birthYear;
  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth && currentDay < birthDay)
  ) {
    age -= 1;
  }
  return age;
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin configuration");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function uploadFile(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, file: File, suffix: string) {
  const safeFileName = String(file.name)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 200);
  const path = `kk-verification/${userId}/${Date.now()}-${suffix}-${safeFileName}`;
  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from("public image").upload(path, fileBuffer, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = await supabase.storage.from("public image").getPublicUrl(path);
  const publicUrl = publicUrlData?.publicUrl;

  return { path, url: publicUrl ?? null };
}

async function findExistingAuthIdByEmail(email: string) {
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { authId: true },
  });

  if (existingUser?.authId) {
    try {
      const admin = getSupabaseAdminClient();
      const { data, error } = await admin.auth.admin.getUserById(existingUser.authId);
      if (!error && data?.user && String(data.user.email || "").toLowerCase() === email.toLowerCase()) {
        return existingUser.authId;
      }
    } catch {
      // If the Auth user no longer exists or cannot be verified, continue to the full search.
    }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  try {
    const admin = getSupabaseAdminClient();
    let page: number | undefined = 1;
    const perPage = 100;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users || data.users.length === 0) {
        return null;
      }

      type SupabaseUserRecord = { id?: string; email?: string | null };
      const match = (data.users as SupabaseUserRecord[]).find(
        (user) => String(user.email || "").toLowerCase() === email.toLowerCase()
      );
      if (match?.id) {
        // Double-check the matched auth user still exists and has the same email.
        try {
          const adminVerify = getSupabaseAdminClient();
          const { data: vdata, error: verror } = await adminVerify.auth.admin.getUserById(match.id);
          if (!verror && vdata?.user && String(vdata.user.email || "").toLowerCase() === email.toLowerCase()) {
            return match.id;
          }
        } catch {
          continue;
        }
      }
      page += 1;
    }
  } catch {
    return null;
  }
}

async function signInAndSetSession(email: string, password: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user?.id) {
    return null;
  }
  return data.user.id;
}

function parseAddress(address: string) {
  const normalized = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  const lower = normalized.toLowerCase();
  const barangay = lower.includes("pico") ? BARANGAY_PICO : "";

  let purok = "";
  for (const value of OFFICIAL_SITIOS) {
    if (lower.includes(value.toLowerCase())) {
      purok = value;
      break;
    }
  }

  if (!purok) {
  for (const value of OFFICIAL_PUROKS) {
    if (lower.includes(value.toLowerCase())) {
      purok = value;
      break;
    }
  }
  }

  if (!purok) {
    const purokMatch = normalized.match(/purok\s*\d+/i);
    if (purokMatch) {
      purok = normalizePurok(purokMatch[0].replace(/\s+/g, " "));
    }
  }

  let addressLine = normalized;
  if (purok) {
    const escapedPurok = purok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    addressLine = addressLine.replace(new RegExp(escapedPurok, "i"), "");
  }
  addressLine = addressLine
    .replace(/barangay\s*pico/gi, "")
    .replace(/brgy\.?\s*pico/gi, "")
    .replace(/\bpico\b/gi, "")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .trim();

  return {
    purok,
    addressLine: addressLine || "Address pending verification",
    barangay,
  };
}

export async function POST(req: NextRequest) {
  let createdAuthUserId: string | null = null;

  try {
    const formData = await req.formData();
    
    // Extract form fields
    const body = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      middleInitial: formData.get("middleInitial"),
      sitio: formData.get("sitio"),
      barangay: formData.get("barangay"),
      municipality: formData.get("municipality"),
      province: formData.get("province"),
      sex: formData.get("sex"),
      age: formData.get("age"),
      birthDate: formData.get("birthDate"),
      email: formData.get("email"),
      facebook: formData.get("facebook"),
      contactNumber: formData.get("contactNumber"),
      civilStatus: formData.get("civilStatus"),
      youthClassification: formData.get("youthClassification"),
      youthAgeGroup: formData.get("youthAgeGroup"),
      workStatus: formData.get("workStatus"),
      educationalBackground: formData.get("educationalBackground"),
      registeredSKVoter: formData.get("registeredSKVoter"),
      votedLastSK: formData.get("votedLastSK"),
      registeredNationalVoter: formData.get("registeredNationalVoter"),
      attendedKKAssembly: formData.get("attendedKKAssembly"),
      assemblyTimes: formData.get("assemblyTimes"),
      noAssemblyReason: formData.get("noAssemblyReason"),
      consent: formData.get("consent") === "true",
      residencyStatementAcknowledgement: formData.get("residencyStatementAcknowledgement") === "true",
      address: formData.get("address"),
      documentType: formData.get("documentType"),
    };

    if (!body.consent) {
      return NextResponse.json({ error: "Consent is required" }, { status: 400 });
    }

    const firstNameInput = String(body.firstName || "").trim();
    const lastNameInput = String(body.lastName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const contactNumber = String(body.contactNumber || "").trim();

    if (!firstNameInput || !lastNameInput) {
      return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const names = splitFullName(`${firstNameInput} ${String(body.middleInitial || "").trim()} ${lastNameInput}`);
    const birthDateInput = String(body.birthDate || "");

    let birthDate: Date;
    try {
      birthDate = new Date(`${birthDateInput}T00:00:00Z`);
      if (Number.isNaN(birthDate.getTime())) {
        throw new Error("Invalid birth date");
      }
    } catch {
      return NextResponse.json({ error: "Invalid birth date" }, { status: 400 });
    }

    const age = computeAge(birthDate);
    const ageInput = String(body.age || "").trim();

    if (age < 15 || age > 30) {
      return NextResponse.json(
        { error: "Age must be between 15 and 30 years old" },
        { status: 400 }
      );
    }

    const { purok, addressLine, barangay } = parseAddress(String(body.address || ""));
    const submittedSitio = normalizeSitio(String(body.sitio || "").trim());
    const resolvedSite = submittedSitio || purok;
    const municipality = String(body.municipality || "").trim();
    const province = String(body.province || "").trim();
    const username = email;
    const temporaryPassword = buildTemporaryPassword(names.lastName, birthDate);

    let authId = await findExistingAuthIdByEmail(email);

    if (!authId) {
      const admin = getSupabaseAdminClient();
      const { data: signupData, error: signupError } = await admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          role: "YOUTH",
        },
      });

      if (signupError || !signupData?.user?.id) {
        console.error("KK profiling auth signup failed", signupError);
        throw new Error("Unable to create auth account. Please contact support.");
      }

      authId = signupData.user.id;
      createdAuthUserId = authId;
    }

    let signedInUserId: string | null = null;
    try {
      signedInUserId = await signInAndSetSession(email, temporaryPassword);
    } catch (loginError) {
      console.error("KK profiling auto-login failed", loginError);
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    // Upload ID and residency files
    const uploads: Array<{ label: string; file: File }> = [];
    const frontFile = formData.get("frontFile") as File | null;
    const backFile = formData.get("backFile") as File | null;
    const residencyFile = formData.get("residencyFile") as File | null;

    if (!frontFile || !backFile) {
      return NextResponse.json(
        { error: "Please upload both the front and back of your valid ID." },
        { status: 400 }
      );
    }

    if (!residencyFile) {
      return NextResponse.json(
        { error: "Please upload your Certificate of Residency." },
        { status: 400 }
      );
    }

    if (!body.residencyStatementAcknowledgement) {
      return NextResponse.json(
        { error: "Please confirm that your Certificate of Residency states you have lived in the barangay for at least 8 months." },
        { status: 400 }
      );
    }

    uploads.push({ label: "front", file: frontFile });
    uploads.push({ label: "back", file: backFile });
    uploads.push({ label: "residency", file: residencyFile });

    // Create a temporary Supabase client to upload files with the authenticated user
    let idDocumentType = "Valid ID + Certificate of Residency";
    let idFrontFileUrl: string | null = null;
    let idBackFileUrl: string | null = null;
    let idSingleFileUrl: string | null = null;

    if (!currentUser?.id) {
      return NextResponse.json(
        { error: "Unable to upload ID documents because the user session could not be established." },
        { status: 500 }
      );
    }

    for (const upload of uploads) {
      if (upload.file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Each file must be less than 10MB." },
          { status: 400 }
        );
      }

      const result = await uploadFile(supabase, currentUser.id, upload.file, upload.label);
      if (upload.label === "front") {
        idFrontFileUrl = result.url;
      } else if (upload.label === "back") {
        idBackFileUrl = result.url;
      } else if (upload.label === "residency") {
        idSingleFileUrl = result.url;
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const kkProfile = await (tx as any).kKProfile.create({
        data: {
          firstName: names.firstName,
          middleName: names.middleName,
          lastName: names.lastName,
          fullName: names.fullName,
          purok: resolvedSite,
          addressLine,
          barangay: BARANGAY_PICO,
          birthDate,
          contactNumber,
          email,
          isVerified: false,
        },
      });

      const existingByEmail = await (tx as any).user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });

      let appUser;
      if (existingByEmail) {
        appUser = await (tx as any).user.update({
          where: { id: existingByEmail.id },
          data: {
            authId,
            email,
            username,
            fullName: names.fullName,
            phoneNumber: contactNumber,
            barangay: BARANGAY_PICO,
            kkProfileId: kkProfile.id,
            mustSecureAccount: true,
            usesTemporaryPassword: true,
          },
        });
      } else {
        appUser = await (tx as any).user.create({
          data: {
            authId,
            email,
            username,
            fullName: names.fullName,
            phoneNumber: contactNumber,
            role: "YOUTH",
            barangay: BARANGAY_PICO,
            kkProfileId: kkProfile.id,
            mustSecureAccount: true,
            usesTemporaryPassword: true,
          },
        });
      }

      const address = `${resolvedSite}, ${BARANGAY_PICO}, ${municipality}, ${province}`;

      await (tx as any).profilingRegistration.create({
        data: {
          userId: appUser.id,
          fullName: names.fullName,
          address,
          sex: String(body.sex || "").trim() || "Not specified",
          age,
          birthDate,
          email,
          facebook: String(body.facebook || "").trim(),
          contactNumber,
          civilStatus: String(body.civilStatus || "").trim() || "Not specified",
          youthClassification: String(body.youthClassification || "").trim() || "Not specified",
          youthAgeGroup: String(body.youthAgeGroup || "").trim() || "Not specified",
          workStatus: String(body.workStatus || "").trim() || "Not specified",
          educationalBackground:
            String(body.educationalBackground || "").trim() || "Not specified",
          registeredSKVoter: String(body.registeredSKVoter || "").trim() || "No",
          votedLastSK: String(body.votedLastSK || "").trim() || "No",
          registeredNationalVoter:
            String(body.registeredNationalVoter || "").trim() || "No",
          attendedKKAssembly: String(body.attendedKKAssembly || "").trim() || "No",
          assemblyTimes: String(body.assemblyTimes || "").trim() || null,
          noAssemblyReason: String(body.noAssemblyReason || "").trim() || null,
          consent: true,
          residencyStatementAcknowledgement: true,
          idDocumentType,
          idFrontFileUrl,
          idBackFileUrl,
          idSingleFileUrl,
          reviewStatus: "Pending",
        },
      });

      return { kkProfileId: kkProfile.id, userId: appUser.id };
    });

    return NextResponse.json({
      success: true,
      kkProfileId: created.kkProfileId,
      userId: created.userId,
      signedIn: Boolean(signedInUserId),
      redirectTo: "/programs/kk-profiling/status",
      credentials: {
        username,
        temporaryPassword,
      },
      message:
        signedInUserId
          ? "Your KK Profiling request has been received with your ID documents and is now pending verification. An SKonnect account was created automatically so you can monitor your status and receive updates."
          : "Your KK Profiling request has been received with your ID documents and is now pending verification. An SKonnect account was created automatically so you can monitor your status and receive updates.",
    });
  } catch (err: any) {
    if (createdAuthUserId) {
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
          const supabaseAdmin = getSupabaseAdminClient();
          await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
        }
      } catch {
        // best-effort cleanup if app database write fails after auth user creation
      }
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "A user with this email already exists. If this is your email, please use Secure Account or contact support.",
          accountExists: true,
        },
        { status: 409 }
      );
    }

    if (err instanceof Error && err.message.includes("currently unavailable")) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }

    if (err instanceof Error && err.message.includes("Missing Supabase")) {
      return NextResponse.json(
        { error: "Server is missing Supabase configuration." },
        { status: 500 }
      );
    }

    console.error(err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
