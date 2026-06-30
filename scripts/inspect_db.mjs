import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const who = await client.query("SELECT current_user, session_user, current_schema();");
  console.log('USER', who.rows);
  const acl = await client.query("SELECT nspname, nspacl FROM pg_namespace WHERE nspname='public';");
  console.log('SCHEMA', acl.rows);
  const tbl = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' LIMIT 5;");
  console.log('TABLES', tbl.rows);
  await client.end();
}
main().catch((err) => { console.error(err); process.exit(1); });
