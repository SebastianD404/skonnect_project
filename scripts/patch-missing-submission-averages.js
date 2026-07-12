require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  console.error('[patch-missing-submission-averages] ERROR: DATABASE_URL or DIRECT_URL is not set.');
  console.error('Set DATABASE_URL in your environment or create a .env file in the project root.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    apply: args.includes('--apply') || args.includes('-a'),
    dryRun: !(args.includes('--apply') || args.includes('-a')),
    limit: (() => {
      const idx = args.findIndex((a) => a === '--limit');
      if (idx === -1) return undefined;
      const val = args[idx + 1];
      return val ? Number(val) : undefined;
    })(),
  };
}

async function main() {
  const opts = parseArgs();

  if (!connectionString) {
    console.error('[patch-missing-submission-averages] ERROR: DATABASE_URL or DIRECT_URL is not set.');
    console.error('Set DATABASE_URL or DIRECT_URL in your environment or create a .env file in the project root.');
    process.exit(1);
  }
  const [gradeRowsColumn] = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND lower(column_name) = 'graderows' LIMIT 1;`
  );

  if (!gradeRowsColumn) {
    console.error('[patch-missing-submission-averages] ERROR: submissions.gradeRows column is not present in the database.');
    console.error('Apply the latest Prisma migration to add gradeRows, then rerun this script.');
    process.exit(1);
  }
  try {
    console.log('[patch-missing-submission-averages] Starting scan (dry-run=%s)', opts.dryRun);

    const where = {
      generalAverage: null,
      gradeFileUrl: { not: '' },
    };

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        gradeRows: true,
        grantee: {
          select: {
            id: true,
            generalAverage: true,
            user: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
      take: opts.limit,
    });

    console.log(`[patch-missing-submission-averages] Found ${submissions.length} submissions with missing average`);

    let toPatch = [];
    for (const s of submissions) {
      const name = s.grantee?.user?.fullName ?? '<no-name>';
      const email = s.grantee?.user?.email ?? '<no-email>';
      const gradeRows = Array.isArray(s.gradeRows) ? s.gradeRows : [];
      const validGrades = gradeRows
        .map((row) => Number(row?.grade))
        .filter((value) => !Number.isNaN(value) && value >= 0 && value <= 100);
      const computedAvg = validGrades.length > 0
        ? Number((validGrades.reduce((sum, value) => sum + value, 0) / validGrades.length).toFixed(2))
        : null;
      const granteeAvg = s.grantee?.generalAverage;

      if (computedAvg !== null) {
        toPatch.push({ id: s.id, name, email, avg: computedAvg });
      } else if (typeof granteeAvg === 'number') {
        toPatch.push({ id: s.id, name, email, avg: granteeAvg });
      } else {
        console.log(`Skipping submission ${s.id} (${name} / ${email}) — no grade rows or grantee average available`);
      }
    }

    console.log(`[patch-missing-submission-averages] ${toPatch.length} submissions eligible to patch`);

    if (toPatch.length === 0) {
      console.log('[patch-missing-submission-averages] Nothing to do.');
      return;
    }

    if (opts.dryRun) {
      console.log('[patch-missing-submission-averages] Dry run — the following would be patched:');
      for (const p of toPatch) {
        console.log(`  - ${p.id} (${p.name} / ${p.email}) -> ${p.avg}`);
      }
      console.log('[patch-missing-submission-averages] Run with --apply to perform updates.');
      return;
    }

    let patched = 0;
    for (const p of toPatch) {
      await prisma.submission.update({ where: { id: p.id }, data: { generalAverage: p.avg } });
      console.log(`Patched submission ${p.id} (${p.name} / ${p.email}) with grantee average ${p.avg}`);
      patched++;
    }

    console.log(`[patch-missing-submission-averages] Done. Patched ${patched} submissions.`);
  } catch (err) {
    console.error('[patch-missing-submission-averages] Error', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch {}
    try {
      await pool.end();
    } catch {}
  }
}

if (require.main === module) {
  main();
}
