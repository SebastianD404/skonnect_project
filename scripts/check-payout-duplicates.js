const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

async function main() {
  try {
    const rows = await db.$queryRaw`
      SELECT "granteeId", COUNT(*)::int AS count
      FROM "accounting_payouts"
      GROUP BY "granteeId"
      HAVING COUNT(*) > 1
      LIMIT 100
    `;

    if (!rows || rows.length === 0) {
      console.log('NO_DUPLICATES');
      return;
    }

    console.log('DUPLICATES_FOUND');
    console.table(rows);
  } catch (err) {
    console.error('ERROR', err && err.message ? err.message : String(err));
    process.exit(2);
  } finally {
    await db.$disconnect();
  }
}

main();
