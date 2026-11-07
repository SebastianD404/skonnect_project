import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import KnowledgeBaseAudit from "@/app/admin/knowledge-base/KnowledgeBaseAudit";

export const dynamic = "force-dynamic";

export default async function SystemAdminKnowledgeBasePage() {
  await requireRole([Role.SUPER_ADMIN]);

  const [documents, categoryRecords] = await Promise.all([
    prisma.chatEmbedding.findMany({
      where: {
        NOT: {
          sourceType: {
            in: ["events", "governance", "technical", "system_overview"],
            mode: "insensitive",
          },
        },
      },
      orderBy: { id: "asc" },
      select: {
        id: true,
        content: true,
        language: true,
        sourceType: true,
        createdAt: true,
      },
    }),
    prisma.chatEmbedding.findMany({
      distinct: ["sourceType"],
      orderBy: { sourceType: "asc" },
      select: { sourceType: true },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <KnowledgeBaseAudit
        databaseCategories={categoryRecords.map(({ sourceType }) => sourceType)}
        documents={documents.map((document) => ({
          ...document,
          createdAt: document.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
