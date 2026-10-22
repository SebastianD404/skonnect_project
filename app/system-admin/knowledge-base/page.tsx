import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import KnowledgeBaseAudit from "@/app/admin/knowledge-base/KnowledgeBaseAudit";

export const dynamic = "force-dynamic";

export default async function SystemAdminKnowledgeBasePage() {
  await requireRole([Role.SUPER_ADMIN]);

  const documents = await prisma.chatEmbedding.findMany({
    where: {
      NOT: {
        sourceType: { in: ["events", "governance", "technical", "system_overview"], mode: "insensitive" },
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
  });

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">AI Assistant</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">RAG Knowledge Base Audit</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review the scholarship knowledge chunks currently available to the assistant. Vector embeddings are not loaded.
        </p>
      </div>
      <KnowledgeBaseAudit
        documents={documents.map((document) => ({
          ...document,
          createdAt: document.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
