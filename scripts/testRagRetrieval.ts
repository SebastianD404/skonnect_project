import "dotenv/config";
import { formatRetrievedContext, retrieveChunksWithCache } from "../lib/chatbot/retrieval";

async function runRetrievalTest() {
  const testQueries = [
    "How can I register for an SK event and what documents do I need?",
    "What are the SKEAP requirements and eligibility criteria?",
    "Tell me about the Katipunan ng Kabataan event schedule.",
  ];

  for (const query of testQueries) {
    console.log("\n=== Test query ===");
    console.log(query);

    const chunks = await retrieveChunksWithCache({ query, topK: 5 });
    console.log(`Retrieved ${chunks.length} chunks.`);

    if (chunks.length === 0) {
      console.log("No chunks returned. Check the embedding index or Gemini key configuration.");
      continue;
    }

    chunks.forEach((chunk, index) => {
      console.log(`\n--- chunk ${index + 1} ---`);
      console.log(`id: ${chunk.id}`);
      console.log(`language: ${chunk.language}`);
      console.log(`sourceType: ${chunk.sourceType}`);
      console.log(`similarity: ${chunk.similarity}`);
      console.log(`preview: ${chunk.content.slice(0, 180).replace(/\s+/g, " ")}...`);
    });

    console.log("\nFormatted retrieved context:\n");
    console.log(formatRetrievedContext(chunks));
  }
}

runRetrievalTest().catch((error) => {
  console.error("RAG retrieval test failed:", error);
  process.exit(1);
});
