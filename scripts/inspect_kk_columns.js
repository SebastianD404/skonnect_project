const { config } = require('dotenv');
const { Client } = require('pg');
config();

(async () => {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('No DATABASE_URL or DIRECT_URL found in env');
  }
  const client = new Client({ connectionString });
  await client.connect();

  const res = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='kk_profiling_registrations' ORDER BY ordinal_position"
  );
  console.log('columns:', JSON.stringify(res.rows, null, 2));

  const migTable = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations'"
  );
  console.log('_prisma_migrations exists:', migTable.rowCount > 0);
  if (migTable.rowCount > 0) {
    const migrations = await client.query(
      'SELECT migration_name, started_at, finished_at, success FROM _prisma_migrations ORDER BY started_at DESC LIMIT 20'
    );
    console.log('migrations:', JSON.stringify(migrations.rows, null, 2));
  }

  await client.end();
})();
