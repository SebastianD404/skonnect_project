import { prisma } from "@/lib/prisma";

export async function refreshInactiveGranteesView() {
  await prisma.$executeRawUnsafe(
    'REFRESH MATERIALIZED VIEW CONCURRENTLY "public"."inactive_grantees_view"'
  );
}
