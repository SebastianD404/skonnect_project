import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { embedText } from "@/lib/chatbot/gemini";
import { retrievalCache } from "@/lib/chatbot/retrieval-cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const MAX_CONTENT_LENGTH = 20_000;
const EMBEDDING_DIMENSIONS = 3072;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid knowledge-base chunk ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const content =
    body && typeof body === "object" && "content" in body && typeof body.content === "string"
      ? body.content.trim()
      : "";
  if (!id.trim() || !content) {
    return NextResponse.json({ error: "Chunk ID and non-empty content are required." }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Chunk content must be ${MAX_CONTENT_LENGTH.toLocaleString()} characters or fewer.` },
      { status: 400 }
    );
  }

  let existingChunk;
  try {
    existingChunk = await prisma.chatEmbedding.findUnique({
      where: { id },
      select: { id: true, content: true, sourceType: true },
    });
  } catch (error) {
    console.error("Failed to load knowledge-base chunk for update:", error);
    return NextResponse.json({ error: "Unable to load the knowledge-base chunk." }, { status: 500 });
  }

  if (!existingChunk || existingChunk.sourceType.toLowerCase() === "events") {
    return NextResponse.json({ error: "Knowledge-base chunk not found." }, { status: 404 });
  }

  let embedding: number[];
  try {
    embedding = await embedText(content);
  } catch (error) {
    console.error("Failed to regenerate knowledge-base embedding:", error);
    return NextResponse.json({ error: "Unable to regenerate the text embedding. The chunk was not updated." }, { status: 502 });
  }

  if (embedding.length !== EMBEDDING_DIMENSIONS || !embedding.every(Number.isFinite)) {
    console.error("Gemini returned an invalid knowledge-base embedding.", {
      dimensions: embedding.length,
    });
    return NextResponse.json({ error: "The embedding service returned an invalid vector. The chunk was not updated." }, { status: 502 });
  }

  const vectorLiteral = `[${embedding.map((value) => value.toFixed(8)).join(",")}]`;
  try {
    await prisma.$transaction(async (transaction) => {
      const updatedCount = await transaction.$executeRaw`
        UPDATE public.chat_embeddings
        SET content = ${content}, embedding = ${vectorLiteral}::vector
        WHERE id = ${id} AND lower("sourceType") <> 'events'
      `;
      if (updatedCount !== 1) {
        throw new Error("Knowledge-base chunk not found.");
      }

      await writeAuditLog(transaction, {
        action: "KNOWLEDGE_BASE_CHUNK_UPDATED",
        actorId: admin.id,
        targetTable: "chat_embeddings",
        targetId: id,
        beforeData: { content: existingChunk.content },
        afterData: { content },
      });
    });
  } catch (error) {
    console.error("Failed to update knowledge-base chunk:", error);
    if (error instanceof Error && error.message === "Knowledge-base chunk not found.") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to save the updated knowledge-base chunk." }, { status: 500 });
  }

  retrievalCache.clear();
  return NextResponse.json({ success: true, id });
}
