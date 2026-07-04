import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import {
  BARANGAY_PICO,
  OFFICIAL_PUROKS,
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
          // If verification fails, continue searching further pages rather than treating it as a match.
        } catch {
          // Ignore verification errors and continue searching pages.
        }
      }

      const hasMorePage: boolean = typeof data.nextPage === "number" && (page === undefined || data.nextPage > page);
      if (!hasMorePage && data.users.length < perPage) {
        return null;
      }

      page = hasMorePage ? (typeof data.nextPage === "number" ? data.nextPage : page) : (page === undefined ? undefined : page + 1);
    }
  } catch {
    return null;
  }
}

async function updateExistingAuthUserPassword(authId: string, password: string, metadata: Record<string, unknown>) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.updateUserById(authId, {
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (error || !data.user) {
    throw new Error(error?.message || "Unable to update existing user credentials.");
  }

  return data.user.id;
}

async function signInAndSetSession(email: string, password: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    throw new Error(error?.message || "Unable to sign in the user after registration.");
  }

  return data.user.id;
}

function getSupabaseProvisioningClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL configuration");
  }

  if (serviceRoleKey) {
    return {
      mode: "admin" as const,
      client: createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }),
    };
  }

  if (!anonKey) {
    throw new Error("Missing Supabase anon key configuration");
  }

  return {
    mode: "signup" as const,
    client: createSupabaseClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
  };
}

function isDuplicateAuthError(message?: string | null) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("already") ||
    normalized.includes("exists") ||
    normalized.includes("duplicate") ||
    normalized.includes("registered") ||
    normalized.includes("user already") ||
    normalized.includes("email already")
  );
}

function parseLegacyAddress(rawAddress: string) {
  const normalized = rawAddress.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { purok: "", addressLine: "", barangay: "" };
  }

  const lower = normalized.toLowerCase();
  const barangay = lower.includes("pico") ? BARANGAY_PICO : "";

  let purok = "";
  for (const value of OFFICIAL_PUROKS) {
    if (lower.includes(value.toLowerCase())) {
      purok = value;
      break;
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

export async function POST(req: Request) {
  let createdAuthUserId: string | null = null;

  try {
    const body = await req.json();
    if (!body || !body.consent) {
      return NextResponse.json({ error: "Consent is required" }, { status: 400 });
    }

    const firstNameInput = String(body.firstName || "").trim();
    const lastNameInput = String(body.lastName || "").trim();
    const middleInitialInput = String(body.middleInitial || "")
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 1)
      .toUpperCase();
    const fullNameFromParts = [firstNameInput, middleInitialInput, lastNameInput]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const fullName = String(body.fullName || "").trim() || fullNameFromParts;
    const legacyAddress = String(body.address || "").trim();
    const legacyParsed = parseLegacyAddress(legacyAddress);
    const sitio = normalizeSitio(String(body.sitio || "").trim());
    const purok = normalizePurok(
      String(body.purok || "").trim() || legacyParsed.purok || sitio
    );
    const municipality = String(body.municipality || "").trim() || "La Trinidad";
    const province = String(body.province || "").trim() || "Benguet";
    const addressLine = String(body.addressLine || "").trim() || `${municipality}, ${province}`;
    const barangayInput =
      String(body.barangay || "").trim() || legacyParsed.barangay || BARANGAY_PICO;
    const email = String(body.email || "").trim().toLowerCase();
    const contactNumber = String(body.contactNumber || "").trim();
    const birthDate = body.birthDate ? new Date(body.birthDate) : null;
    const sex = String(body.sex || "").trim() || "Not specified";

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }
    if (!purok) {
      return NextResponse.json(
        { error: "Complete address must include an official Barangay Pico sitio or purok." },
        { status: 400 }
      );
    }

    const hasValidSitio = sitio ? isOfficialSitio(sitio) : false;
    const hasValidPurok = isOfficialPurok(purok);
    if (!hasValidSitio && !hasValidPurok) {
      return NextResponse.json(
        { error: "Address must use an official Barangay Pico area (sitio/purok)." },
        { status: 400 }
      );
    }
    if (!addressLine) {
      return NextResponse.json({ error: "Address line is required" }, { status: 400 });
    }
    if (!isBarangayPico(barangayInput)) {
      return NextResponse.json(
        { error: "Only Barangay Pico residents can register through this portal." },
        { status: 400 }
      );
    }
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!contactNumber) {
      return NextResponse.json({ error: "Contact number is required" }, { status: 400 });
    }
    if (!birthDate || Number.isNaN(birthDate.getTime())) {
      return NextResponse.json({ error: "Valid birth date is required" }, { status: 400 });
    }

    const age = computeAge(birthDate);
    if (age < 15 || age > 30) {
      return NextResponse.json(
        { error: "KK registration is only available for youth ages 15 to 30." },
        { status: 400 }
      );
    }

    const names = splitFullName(fullName);
    const temporaryPassword = buildTemporaryPassword(names.lastName, birthDate);
    const username = email;
    const metadata = {
      full_name: names.fullName,
      must_secure_account: true,
      temporary_credential: true,
    };

    const provisioning = getSupabaseProvisioningClient();

    let authId: string;
    if (provisioning.mode === "admin") {
      const { data: createdAuth, error: authCreateError } =
        await provisioning.client.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: metadata,
        });

      if (authCreateError || !createdAuth.user) {
        if (isDuplicateAuthError(authCreateError?.message)) {
          const existingAuthId = await findExistingAuthIdByEmail(email);
          if (!existingAuthId) {
            return NextResponse.json(
              {
                error: "Unable to create account credentials. Please try again or contact support.",
              },
              { status: 400 }
            );
          }

          authId = await updateExistingAuthUserPassword(existingAuthId, temporaryPassword, metadata);
        } else {
          return NextResponse.json(
            { error: authCreateError?.message || "Unable to create account credentials." },
            { status: 400 }
          );
        }
      } else {
        authId = createdAuth.user.id;
        createdAuthUserId = authId;
      }
      } else {
      const { data: signupData, error: signupError } = await provisioning.client.auth.signUp({
        email,
        password: temporaryPassword,
        options: {
          data: metadata,
        },
      });

      if (signupError || !signupData.user) {
        if (isDuplicateAuthError(signupError?.message)) {
          const existingAuthId = await findExistingAuthIdByEmail(email);
          if (!existingAuthId) {
            return NextResponse.json(
              {
                error: "Unable to create account credentials. Please try again or contact support.",
              },
              { status: 400 }
            );
          }

          if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
              { error: "Unable to create account. Please contact support." },
              { status: 400 }
            );
          }

          authId = await updateExistingAuthUserPassword(existingAuthId, temporaryPassword, metadata);
        } else {
          return NextResponse.json(
            { error: signupError?.message || "Unable to provision account credentials." },
            { status: 400 }
          );
        }
      } else {
        authId = signupData.user.id;
        createdAuthUserId = authId;
      }
    }

    let signedInUserId: string | null = null;
    try {
      signedInUserId = await signInAndSetSession(email, temporaryPassword);
    } catch (loginError) {
      console.error("KK profiling auto-login failed", loginError);
    }

    const created = await prisma.$transaction(async (tx) => {
      const kkProfile = await tx.kKProfile.create({
        data: {
          firstName: names.firstName,
          middleName: names.middleName,
          lastName: names.lastName,
          fullName: names.fullName,
          purok,
          addressLine,
          barangay: BARANGAY_PICO,
          birthDate,
          contactNumber,
          email,
          isVerified: true,
        },
      });

      const existingByEmail = await tx.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });

      let appUser;
      if (existingByEmail) {
        appUser = await tx.user.update({
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
        appUser = await tx.user.create({
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

      const address = `${purok}, ${BARANGAY_PICO}, ${municipality}, ${province}`;

      await tx.profilingRegistration.create({
        data: {
          userId: appUser.id,
          fullName: names.fullName,
          address,
          sex,
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
        },
      });

      return { kkProfileId: kkProfile.id, userId: appUser.id };
    });

    return NextResponse.json({
      success: true,
      kkProfileId: created.kkProfileId,
      userId: created.userId,
      signedIn: Boolean(signedInUserId),
      redirectTo: "/programs/skeap-scholarship?openApply=1",
      credentials: {
        username,
        temporaryPassword,
      },
      message:
        signedInUserId
          ? "Your KK profiling was completed successfully. Your SKonnect account was created automatically and you are now signed in. You can update your username and password later from Account Settings."
          : "Your KK profiling was completed successfully. Your SKonnect account was created automatically. Please use the credentials below to sign in if you are not already signed in.",
    });
  } catch (err) {
    if (createdAuthUserId) {
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

    if (err instanceof Error && err.message.includes("Missing Supabase URL configuration")) {
      return NextResponse.json(
        { error: "Server is missing Supabase URL configuration." },
        { status: 500 }
      );
    }

    if (err instanceof Error && err.message.includes("Missing Supabase anon key configuration")) {
      return NextResponse.json(
        { error: "Server is missing Supabase anon key configuration." },
        { status: 500 }
      );
    }

    console.error(err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
