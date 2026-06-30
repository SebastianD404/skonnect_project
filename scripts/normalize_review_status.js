require('dotenv').config();
const { Client } = require('pg');

const canonicalRules = [
  { canonical: 'Cancelled', patterns: ['cancel'] },
  { canonical: 'Approved', patterns: ['approve'] },
  { canonical: 'Resubmitted', patterns: ['resubm'] },
  { canonical: 'Returned', patterns: ['return', 'correction', 'revise', 'revision'] },
  { canonical: 'Pending review', patterns: ['pending'] },
  { canonical: 'Ineligible', patterns: ['reject', 'ineligible'] },
  { canonical: 'Responded', patterns: ['respond'] },
];

function canonicalize(value, response) {
  const normalizedValue = value == null ? '' : String(value).trim();
  const lowered = normalizedValue.toLowerCase();

  if (lowered) {
    for (const rule of canonicalRules) {
      if (rule.patterns.some((pattern) => lowered.includes(pattern))) {
        return rule.canonical;
      }
    }
  }

  const normalizedResponse = response == null ? '' : String(response).trim().toLowerCase();
  if (normalizedResponse) {
    if (normalizedResponse.includes('cancel')) return 'Cancelled';
    if (normalizedResponse.includes('approve')) return 'Approved';
    if (['returned', 'correction', 'resubmit', 'revise', 'revision'].some((pattern) => normalizedResponse.includes(pattern))) {
      return 'Returned';
    }
  }

  return 'Pending review';
}

(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not defined in environment');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  const apply = process.argv.includes('--apply');

  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, "reviewStatus" AS reviewStatus, response, subject, "createdAt" AS createdAt
       FROM inquiries
       WHERE subject ILIKE '%SKEAP application%'
       ORDER BY "createdAt" DESC
       LIMIT 1000`,
    );

    const currentTotals = rows.reduce((acc, row) => {
      const key = row.reviewStatus ?? '<NULL>';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const updates = rows
      .map((row) => {
        const canonical = canonicalize(row.reviewStatus, row.response);
        return {
          id: row.id,
          current: row.reviewStatus ?? '<NULL>',
          canonical,
        };
      })
      .filter((item) => item.canonical && item.canonical !== item.current);

    console.log('=== Current review_status totals ===');
    Object.entries(currentTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => console.log(`${count.toString().padStart(4)}  ${status}`));

    if (updates.length === 0) {
      console.log('\nNo review_status values require normalization.');
      process.exit(0);
    }

    const canonicalTotals = updates.reduce((acc, item) => {
      acc[item.canonical] = (acc[item.canonical] || 0) + 1;
      return acc;
    }, {});

    console.log('\n=== Proposed normalizations ===');
    Object.entries(canonicalTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([canonical, count]) => console.log(`${count.toString().padStart(4)}  -> ${canonical}`));

    console.log(`\nTotal rows to update: ${updates.length}`);
    console.log('Example rows:');
    updates.slice(0, 20).forEach((item) => console.log(`- ${item.id}: '${item.current}' -> '${item.canonical}'`));

    if (!apply) {
      console.log('\nDry run only. Add --apply to execute the normalization.');
      process.exit(0);
    }

    console.log('\nApplying normalization...');
    await client.query('BEGIN');
    for (const item of updates) {
      await client.query('UPDATE inquiries SET "reviewStatus" = $1 WHERE id = $2', [item.canonical, item.id]);
    }
    await client.query('COMMIT');
    console.log('Normalization applied successfully.');
  } catch (error) {
    console.error('Normalization failed:', error);
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
})();
