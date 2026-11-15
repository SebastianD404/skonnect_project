import { prisma } from "@/lib/prisma";

export async function getApprovedKkProfileCount() {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    WITH ranked_profiles AS (
      SELECT
        registration."id",
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(
            NULLIF(LOWER(BTRIM(user_record."email")), ''),
            NULLIF(LOWER(BTRIM(registration."email")), ''),
            NULLIF(registration."userId", ''),
            registration."id"
          )
          ORDER BY registration."submittedAt" DESC, registration."id" DESC
        ) AS identity_rank
      FROM public."kk_profiling_registrations" AS registration
      LEFT JOIN public."users" AS user_record
        ON user_record."id" = registration."userId"
      WHERE registration."reviewStatus" = 'Approved'
    )
    SELECT COUNT(*)::int AS count
    FROM ranked_profiles
    WHERE identity_rank = 1
  `;

  return rows[0]?.count ?? 0;
}
