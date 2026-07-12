require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  console.error('No DATABASE_URL or DIRECT_URL set');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  try {
    const columns = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'submissions'
       ORDER BY ordinal_position;`
    );
    console.log('Columns:');
    console.log(columns.rows.map((row) => `${row.column_name} ${row.data_type} ${row.is_nullable}`).join('\n'));

    const { rows } = await pool.query(
      `SELECT id, grade_rows, general_average, coe_file_url, grade_file_url, status, flagged_fields, submitted_at, reviewed_at
       FROM submissions
       WHERE id = $1`,
      ['618acf2a-32a4-4c64-b81a-1435ea295668']
    );

    console.log('Row:');
    console.log(JSON.stringify(rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
