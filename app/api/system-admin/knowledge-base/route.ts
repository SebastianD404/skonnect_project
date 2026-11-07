import { randomUUID } from "node:crypto";
import { Language, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { categorizeKnowledgeContent, embedText } from "@/lib/chatbot/gemini";
import { detectLanguage } from "@/lib/chatbot/language";
import { retrievalCache } from "@/lib/chatbot/retrieval-cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const MAX_CONTENT_LENGTH = 20_000;
const EMBEDDING_DIMENSIONS = 3072;
type CreatedDocument = {
  id: string;
  content: string;
  language: Language;
  sourceType: string;
  createdAt: Date;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await ensureProfile(user);
    if (!admin || admin.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
    }

    const { content } = body as Record<string, unknown>;
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Knowledge chunk content is required." }, { status: 400 });
    }

    const normalizedContent = content.trim();
    if (normalizedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Chunk content must be ${MAX_CONTENT_LENGTH.toLocaleString()} characters or fewer.` },
        { status: 400 }
      );
    }

    let categories: string[];
    try {
      const categoryRecords = await prisma.chatEmbedding.findMany({
        distinct: ["sourceType"],
        select: { sourceType: true },
      });
      categories = categoryRecords.map(({ sourceType }) => sourceType);
    } catch (error) {
      console.error("Failed to load knowledge-base categories:", error);
      return NextResponse.json({ error: "Unable to load knowledge categories." }, { status: 500 });
    }

    let category: string;
    try {
      category = await categorizeKnowledgeContent(normalizedContent, categories);
    } catch (error) {
      console.error("Failed to categorize knowledge-base content:", error);
      return NextResponse.json({ error: "Unable to categorize the policy note. It was not added." }, { status: 502 });
    }

    const language = detectLanguage(normalizedContent);
    let embedding: number[];
    try {
      embedding = await embedText(normalizedContent);
    } catch (error) {
      console.error("Failed to generate knowledge-base embedding:", error);
      return NextResponse.json({ error: "Unable to generate a text embedding. The chunk was not added." }, { status: 502 });
    }

    if (embedding.length !== EMBEDDING_DIMENSIONS || !embedding.every(Number.isFinite)) {
      console.error("Gemini returned an invalid knowledge-base embedding.", {
        dimensions: embedding.length,
      });
      return NextResponse.json({ error: "The embedding service returned an invalid vector. The chunk was not added." }, { status: 502 });
    }

    const id = randomUUID();
    const vectorLiteral = `[${embedding.map((value) => value.toFixed(8)).join(",")}]`;
    const document = await prisma.$transaction(async (transaction) => {
      const inserted = await transaction.$queryRaw<CreatedDocument[]>`
        INSERT INTO public.chat_embeddings (id, content, language, "sourceType", embedding)
        VALUES (
          ${id},
          ${normalizedContent},
          ${language}::"Language",
          ${category},
          ${vectorLiteral}::vector
        )
        RETURNING id, content, language, "sourceType", "createdAt" AS "createdAt"
      `;
      const createdDocument = inserted[0];
      if (!createdDocument) {
        throw new Error("Knowledge chunk insert returned no record.");
      }

      await writeAuditLog(transaction, {
        action: "KNOWLEDGE_BASE_CHUNK_CREATED",
        actorId: admin.id,
        targetTable: "chat_embeddings",
        targetId: id,
        afterData: {
          category,
          language,
          contentLength: normalizedContent.length,
        },
      });

      return createdDocument;
    });

    retrievalCache.clear();
    revalidatePath("/system-admin/knowledge-base");
    return NextResponse.json({
      success: true,
      document: {
        ...document,
        createdAt: document.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to add knowledge-base chunk:", error);
    return NextResponse.json({ error: "Failed to add the knowledge-base chunk." }, { status: 500 });
  }
}
