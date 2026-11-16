import { prisma } from "@/lib/prisma";

type AdminMaterializedView =
  | "skeap_applications_admin_mv"
  | "kk_profiling_applications_admin_mv";

async function refreshAdminView(viewName: AdminMaterializedView) {
  try {
    await prisma.$executeRawUnsafe(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY "public"."${viewName}"`
    );
  } catch (concurrentError) {
    console.warn(
      `Concurrent refresh failed for ${viewName}; retrying with a blocking refresh.`,
      concurrentError,
    );
    await prisma.$executeRawUnsafe(
      `REFRESH MATERIALIZED VIEW "public"."${viewName}"`
    );
  }
}

export async function refreshSkeapApplicationsAdminView() {
  await refreshAdminView("skeap_applications_admin_mv");
}

export async function refreshKkProfilingApplicationsAdminView() {
  await refreshAdminView("kk_profiling_applications_admin_mv");
}
