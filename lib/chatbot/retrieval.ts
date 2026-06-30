import type { Language } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { embedText } from "@/lib/chatbot/gemini";
import { buildQueryHash, retrievalCache, retrievalCacheTtlMs } from "@/lib/chatbot/retrieval-cache";

function getGeminiKey() {
  return process.env.GOOGLE_GEMINI_API_KEY || null;
}

export type RetrievedChunk = {
  id: string;
  content: string;
  language: Language;
  sourceType: string;
  similarity: number;
};

function sanitizeVector(values: number[]) {
  return values.map((value) => Number(value.toFixed(8)));
}

async function retrieveFromPgVector(query: string, topK: number, minSimilarity = 0.4): Promise<RetrievedChunk[]> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    return [];
  }

  const embedding = sanitizeVector(await embedText(query));
  const vectorLiteral = `[${embedding.join(",")}]`;

  const rows = await prisma.$queryRawUnsafe<RetrievedChunk[]>(
    `
      SELECT
        id,
        content,
        language,
        "sourceType",
        1 - (embedding <=> $1::vector) AS similarity
      FROM chat_embeddings
      WHERE embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $3::double precision
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `,
    vectorLiteral,
    topK,
    minSimilarity
  );

  return rows;
}

export async function retrieveChunksWithCache(params: {
  query: string;
  topK?: number;
  minSimilarity?: number;
}): Promise<RetrievedChunk[]> {
  const topK = params.topK ?? 10;
  const minSimilarity = params.minSimilarity ?? 0.4;
  const cacheKey = `${buildQueryHash(params.query)}|topK=${topK}|minSimilarity=${minSimilarity}`;

  const cached = retrievalCache.get(cacheKey);
  if (cached) {
    return cached as RetrievedChunk[];
  }

  try {
    const chunks = await retrieveFromPgVector(params.query, topK, minSimilarity);
    retrievalCache.set(cacheKey, chunks, retrievalCacheTtlMs);
    return chunks;
  } catch (error) {
    console.warn("Chat retrieval failed, proceeding without context:", error);
    retrievalCache.set(cacheKey, [], retrievalCacheTtlMs);
    return [];
  }
}

export function formatRetrievedContext(chunks: RetrievedChunk[]) {
  if (chunks.length === 0) {
    return "";
  }

  return chunks
    .map((chunk, index) => {
      const score = Number.isFinite(chunk.similarity) ? chunk.similarity.toFixed(3) : "n/a";
      return `[#${index + 1}] (${chunk.sourceType}, score=${score})\n${chunk.content}`;
    })
    .join("\n\n");
}
