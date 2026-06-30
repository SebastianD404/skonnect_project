import "dotenv/config";
import { Client } from "pg";

async function verify() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL in environment.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const countResult = await client.query("SELECT count(*) AS count FROM public.chat_embeddings;");
  console.log("chat_embeddings count =", countResult.rows[0].count);

  const sampleResult = await client.query(
    `SELECT id, language, "sourceType", substring(content, 1, 120) AS preview
     FROM public.chat_embeddings
     ORDER BY "createdAt" DESC
     LIMIT 5;`
  );
  console.log(sampleResult.rows);

  await client.end();
}

verify().catch((error) => {
  console.error("Verification failed:", error);
  process.exit(1);
});
