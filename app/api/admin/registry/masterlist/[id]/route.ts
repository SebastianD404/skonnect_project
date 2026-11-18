import { GranteeStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getOfficialKkSitio } from "@/lib/address";
import { writeAuditLog } from "@/lib/audit/logger";
import { refreshKkProfilingApplicationsAdminView, refreshSkeapApplicationsAdminView, refreshSystemUsersAdminView } from "@/lib/application-admin-view-refresh";
import { closeOpenSkeapApplicationsForKkArchive } from "@/lib/kk-archive-skeap-applications";
import {
  KK_MEMBER_AGE_OUT_SCHOLAR_REMARK,
  KK_MEMBER_MANUAL_AGE_OUT_REASON,
} from "@/lib/kk-member-archive";
import { getKKYouthAgeGroup } from "@/lib/kk-youth-age";
import { notifyProfileArchived } from "@/lib/notify-profile-archived";
import { prisma } from "@/lib/prisma";
import { getExactAge } from "@/lib/skeap-age";
import { formatSexLabel, parseSex } from "@/lib/sex";

function parseBirthDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function splitKkProfileName(fullName: string) {
  const commaParts = fullName.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    return {
      lastName: commaParts[0],
      firstName: commaParts[1],
      middleName: commaParts.slice(2).join(" ") || null,
    };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? fullName,
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
    lastName: parts.length > 1 ? parts[parts.length - 1] : "",
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter valid profile details." }, { status: 400 });
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return NextResponse.json({ error: "Enter valid profile details." }, { status: 400 });
  }

  const input = payload as Record<string, unknown>;
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const address = typeof input.address === "string" ? input.address.trim() : "";
  const sitio = typeof input.sitio === "string" ? input.sitio.trim() : "";
  const contactNumber = typeof input.contactNumber === "string" ? input.contactNumber.trim() : "";
  const youthClassification = typeof input.youthClassification === "string"
    ? input.youthClassification.trim()
    : "";
  const registeredSKVoter = typeof input.registeredSKVoter === "string"
    ? input.registeredSKVoter.trim()
    : "";
  const birthDate = parseBirthDate(input.birthDate);
  const sex = parseSex(input.sex);
  const confirmActiveScholarAgeOut = input.confirmActiveScholarAgeOut === true;

  if (!fullName || !address || !contactNumber || !youthClassification) {
    return NextResponse.json(
      { error: "Name, address, contact number, and classification are required." },
      { status: 400 },
    );
  }
  if (!birthDate) {
    return NextResponse.json({ error: "Enter a valid date of birth." }, { status: 400 });
  }
  if (!sex) {
    return NextResponse.json({ error: "Choose a valid sex value." }, { status: 400 });
  }
  if (registeredSKVoter !== "Yes" && registeredSKVoter !== "No") {
    return NextResponse.json({ error: "Choose Yes or No for SK voter status." }, { status: 400 });
  }

  const age = getExactAge(birthDate);
  if (age === null || age < 0) {
    return NextResponse.json({ error: "Date of birth cannot be in the future." }, { status: 400 });
  }
  const ageGroup = getKKYouthAgeGroup(age);
  if (!ageGroup) {
    return NextResponse.json({ error: "Unable to calculate the resident's age group." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const registration = await tx.profilingRegistration.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              grantee: { select: { id: true, status: true, remarks: true } },
              kkProfile: {
                select: {
                  id: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  fullName: true,
                  purok: true,
                  addressLine: true,
                  barangay: true,
                  birthDate: true,
                  placeOfBirth: true,
                  contactNumber: true,
                  sex: true,
                  email: true,
                },
              },
            },
          },
        },
      });
      if (!registration) return { error: "Profile not found.", status: 404 as const };
      if (registration.reviewStatus.trim().toLowerCase() !== "approved") {
        return { error: "Only approved KK profiles can be edited from the masterlist.", status: 409 as const };
      }

      const grantee = registration.user?.grantee;
      const isActiveScholar = grantee?.status === GranteeStatus.ACTIVE ||
        grantee?.status === GranteeStatus.PROBATIONARY;
      if (age >= 31 && isActiveScholar && !confirmActiveScholarAgeOut) {
        return {
          error: "Confirm the SKEAP scholarship age-out transition before saving.",
          code: "ACTIVE_SCHOLAR_CONFIRMATION_REQUIRED" as const,
          status: 409 as const,
        };
      }

      const now = new Date();
      const isAgedOut = age >= 31;
      const archivedReason = isAgedOut ? KK_MEMBER_MANUAL_AGE_OUT_REASON : registration.archivedReason;
      const archivedAt = isAgedOut ? now : registration.archivedAt;
      const profileName = splitKkProfileName(fullName);
      const transition = await tx.profilingRegistration.updateMany({
        where: { id, reviewStatus: registration.reviewStatus },
        data: {
          fullName,
          address,
          sex: formatSexLabel(sex),
          age,
          birthDate,
          contactNumber,
          youthClassification,
          youthAgeGroup: ageGroup,
          registeredSKVoter,
          ...(isAgedOut
            ? {
                reviewStatus: "Archived",
                archivedReason: KK_MEMBER_MANUAL_AGE_OUT_REASON,
                archivedAt: now,
                archivedBy: admin.id,
              }
            : {}),
        },
      });
      if (transition.count !== 1) {
        return { error: "The profile changed while you were editing it. Refresh and try again.", status: 409 as const };
      }

      if (registration.user) {
        await tx.user.update({
          where: { id: registration.user.id },
          data: {
            fullName,
            phoneNumber: contactNumber,
            ...(isAgedOut ? { kkStatus: "AGED_OUT" } : {}),
          },
        });
        if (registration.user.kkProfile) {
          await tx.kKProfile.update({
            where: { id: registration.user.kkProfile.id },
            data: {
              ...profileName,
              fullName,
              purok: sitio || getOfficialKkSitio(address) || registration.user.kkProfile.purok,
              addressLine: address,
              birthDate,
              contactNumber,
              sex,
            },
          });
        }

        if (isAgedOut) {
          const archiveMessage = `Your KK profile was archived because your calculated age is ${age}, above the maximum eligible age of 30 under RA 10742.`;
          await closeOpenSkeapApplicationsForKkArchive(tx, {
            userId: registration.user.id,
            actorId: admin.id,
            reason: KK_MEMBER_MANUAL_AGE_OUT_REASON,
            message: archiveMessage,
          });
        }
      }

      if (isAgedOut && grantee && isActiveScholar) {
        const granteeUpdate = await tx.grantee.updateMany({
          where: { id: grantee.id, status: grantee.status },
          data: {
            status: GranteeStatus.REMOVED,
            dateRemoved: now,
            remarks: KK_MEMBER_AGE_OUT_SCHOLAR_REMARK,
          },
        });
        if (granteeUpdate.count !== 1) {
          throw new Error("GRANTEE_STATUS_CHANGED_DURING_PROFILE_EDIT");
        }
        await writeAuditLog(tx, {
          action: "GRANTEE_STATUS_CHANGED",
          actorId: admin.id,
          targetTable: "grantees",
          targetId: grantee.id,
          beforeData: { status: grantee.status, remarks: grantee.remarks },
          afterData: {
            status: GranteeStatus.REMOVED,
            dateRemoved: now.toISOString(),
            remarks: KK_MEMBER_AGE_OUT_SCHOLAR_REMARK,
          },
          metadata: { reason: KK_MEMBER_MANUAL_AGE_OUT_REASON, currentAge: age },
        });
      }

      const saved = await tx.profilingRegistration.findUniqueOrThrow({ where: { id } });
      await writeAuditLog(tx, {
        action: "MANUAL_PROFILE_UPDATE",
        actorId: admin.id,
        targetTable: "kk_profiling_registrations",
        targetId: id,
        beforeData: {
          fullName: registration.fullName,
          address: registration.address,
          sex: registration.sex,
          age: registration.age,
          birthDate: registration.birthDate.toISOString(),
          contactNumber: registration.contactNumber,
          youthClassification: registration.youthClassification,
          youthAgeGroup: registration.youthAgeGroup,
          registeredSKVoter: registration.registeredSKVoter,
        },
        afterData: {
          fullName,
          address,
          sex: formatSexLabel(sex),
          age,
          birthDate: birthDate.toISOString(),
          contactNumber,
          youthClassification,
          youthAgeGroup: ageGroup,
          registeredSKVoter,
        },
        metadata: { editedFrom: "admin-registry-masterlist" },
      });

      if (isAgedOut) {
        await writeAuditLog(tx, {
          action: "PROFILE_ARCHIVED",
          actorId: admin.id,
          targetTable: "kk_profiling_registrations",
          targetId: id,
          beforeData: {
            reviewStatus: registration.reviewStatus,
            archivedReason: registration.archivedReason,
            archivedAt: registration.archivedAt?.toISOString() ?? null,
          },
          afterData: {
            reviewStatus: "Archived",
            archivedReason,
            archivedAt: archivedAt?.toISOString() ?? now.toISOString(),
            archivedBy: admin.id,
          },
          metadata: {
            fullName,
            birthDate: birthDate.toISOString(),
            currentAge: age,
            maxEligibleAge: 30,
            trigger: "admin-profile-edit",
          },
        });
      }

      const updatedGrantee = isAgedOut && grantee && isActiveScholar
        ? { ...grantee, status: GranteeStatus.REMOVED, remarks: KK_MEMBER_AGE_OUT_SCHOLAR_REMARK }
        : grantee;
      const updatedKkProfile = registration.user?.kkProfile
        ? {
            ...registration.user.kkProfile,
            ...profileName,
            fullName,
            purok: sitio || getOfficialKkSitio(address) || registration.user.kkProfile.purok,
            addressLine: address,
            birthDate,
            contactNumber,
            sex,
          }
        : null;
      return {
        saved,
        ageGroup,
        skeapStatus: isAgedOut && updatedGrantee && isActiveScholar
          ? "AGED_OUT_CONCLUDED"
          : updatedGrantee?.status ?? "NONE",
        user: registration.user
          ? {
              fullName,
              id: registration.user.id,
              email: registration.user.email,
              grantee: updatedGrantee,
            }
          : null,
        kkProfile: updatedKkProfile,
      };
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, ...(result.code ? { code: result.code } : {}) },
        { status: result.status },
      );
    }

    const archiveNotification = result.saved.reviewStatus === "Archived"
      ? await notifyProfileArchived({
          userId: result.saved.userId,
          email: result.user?.email ?? result.saved.email,
          fullName: result.user?.fullName ?? result.saved.fullName,
          archiveType: "AGED_OUT",
          reason: result.saved.archivedReason,
          archivedAt: result.saved.archivedAt ?? new Date(),
        })
      : null;

    await Promise.all([
      refreshKkProfilingApplicationsAdminView(),
      ...(result.saved.reviewStatus === "Archived"
        ? [refreshSkeapApplicationsAdminView(), refreshSystemUsersAdminView()]
        : []),
    ]);
    revalidatePath("/admin/registry/masterlist");
    revalidatePath("/admin/members/records");
    revalidatePath("/admin");

    return NextResponse.json({
      ...result.saved,
      ageGroup: result.ageGroup,
      skeapStatus: result.skeapStatus,
      user: result.user,
      kkProfile: result.kkProfile,
      archiveNotification,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "GRANTEE_STATUS_CHANGED_DURING_PROFILE_EDIT") {
      return NextResponse.json(
        { error: "The SKEAP status changed while you were editing. Refresh and try again." },
        { status: 409 },
      );
    }
    console.error("Failed to edit masterlist profile:", error);
    return NextResponse.json({ error: "Failed to save profile changes." }, { status: 500 });
  }
}
