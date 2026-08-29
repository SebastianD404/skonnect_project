const { Pool } = require('pg');

const fs = require('fs');
let connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  try {
    const env = fs.readFileSync(require('path').join(__dirname, '..', '.env'), 'utf8');
    const match = env.match(/DATABASE_URL\s*=\s*"?(.*?)"?\s*$/m);
    if (match) connectionString = match[1];
  } catch (e) {
    // ignore
  }
}

if (!connectionString) {
  console.error('No DATABASE_URL or DIRECT_URL found in env or .env file.');
  process.exit(2);
}

const pool = new Pool({ connectionString });

async function main() {
  const semesterArg = process.argv[2] || '2026-2027 First Semester';
  const sem = String(semesterArg).replace(/\s*\(Current\)$/i, '').trim();
  console.log('Checking semester:', sem);

  const searchParam = `%${sem}%`;

  try {
    const subCountRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM submissions WHERE semester ILIKE $1', [searchParam]);
    console.log('submission count matching semester (ILIKE %sem%):', subCountRes.rows[0].cnt);

    const subsRes = await pool.query(
      'SELECT id::text AS id, "granteeId"::text AS "granteeId", status, semester, "submittedAt" FROM submissions WHERE semester ILIKE $1 ORDER BY "submittedAt" DESC LIMIT 10',
      [searchParam]
    );
    console.log('sample submissions:', subsRes.rows);

    const grCountRes = await pool.query(
      `SELECT COUNT(DISTINCT g.id)::int AS cnt
       FROM grantees g
       JOIN submissions s ON s."granteeId" = g.id
       WHERE s.semester ILIKE $1`,
      [searchParam]
    );
    console.log('grantees with submissions for semester (count):', grCountRes.rows[0].cnt);

    const grRes = await pool.query(
      `SELECT DISTINCT g.id::text AS id, u."fullName" AS student_name, s.semester
       FROM grantees g
       JOIN users u ON u.id = g."userId"
       JOIN submissions s ON s."granteeId" = g.id
       WHERE s.semester ILIKE $1
       LIMIT 20`,
      [searchParam]
    );
    console.log('sample grantees:', grRes.rows);

    // Also show distinct semesters and statuses present in submissions
    const sems = await pool.query(`SELECT DISTINCT semester FROM submissions ORDER BY semester LIMIT 200`);
    console.log('distinct semesters (up to 200):', sems.rows.map(r => r.semester));

    const stats = await pool.query(`SELECT DISTINCT status FROM submissions`);
    console.log('distinct statuses:', stats.rows.map(r => r.status));
  } catch (err) {
    console.error('ERROR', err && err.message ? err.message : String(err));
    process.exit(2);
  } finally {
    await pool.end();
  }
}

main();
