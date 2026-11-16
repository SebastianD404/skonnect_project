import { prisma } from "@/lib/prisma";
import { refreshSystemUsersAdminView } from "@/lib/application-admin-view-refresh";

export async function refreshInactiveGranteesView() {
  await prisma.$executeRawUnsafe(
    'REFRESH MATERIALIZED VIEW CONCURRENTLY "public"."inactive_grantees_view"'
  );
  await refreshSystemUsersAdminView();
}
