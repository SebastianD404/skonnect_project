require('dotenv').config();
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  try {
    const id = 'af353155-c74f-45d2-ac31-0056b1a4d858';
    const result = await pool.query('SELECT id, "userId", school, "yearLevel" FROM grantees WHERE id = $1', [id]);
    console.log('id:', id);
    console.log('rowCount:', result.rowCount);
    console.log('rows:', result.rows);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
