const { PrismaClient, Prisma } = require('@prisma/client');

(async function main() {
  const prisma = new PrismaClient();
  try {
    const subjectWhere = { subject: { contains: 'SKEAP application', mode: Prisma.QueryMode.insensitive } };
    const excludeCancelled = { reviewStatus: { contains: 'cancel', mode: Prisma.QueryMode.insensitive } };
    const excludeApproved = { reviewStatus: { contains: 'approve', mode: Prisma.QueryMode.insensitive } };

    const baseWhere = { ...subjectWhere };

    const pendingCount = await prisma.inquiry.count({ where: { ...baseWhere, AND: [{ OR: [{ reviewStatus: { contains: 'pending', mode: Prisma.QueryMode.insensitive } }] }], NOT: [excludeCancelled, excludeApproved] } });
    const returnedCount = await prisma.inquiry.count({ where: { ...baseWhere, AND: [{ OR: [ { reviewStatus: { contains: 'return', mode: Prisma.QueryMode.insensitive } }, { reviewStatus: { contains: 'correction', mode: Prisma.QueryMode.insensitive } }, { reviewStatus: { contains: 'resubm', mode: Prisma.QueryMode.insensitive } } ] }], NOT: [excludeCancelled] } });
    const approvedCount = await prisma.inquiry.count({ where: { ...baseWhere, AND: [{ OR: [{ reviewStatus: { contains: 'approve', mode: Prisma.QueryMode.insensitive } }] }] } });

    console.log('AGGREGATE COUNTS:');
    console.log({ pendingCount, returnedCount, approvedCount });

    // Show distinct reviewStatus values and counts
    try {
      const statusGroups = await prisma.inquiry.groupBy({ by: ['reviewStatus'], _count: { _all: true }, where: subjectWhere });
      console.log('\nDistinct reviewStatus groups (subject filter):');
      console.table(statusGroups.map(s => ({ reviewStatus: s.reviewStatus ?? '<NULL>', count: s._count._all })));
    } catch (e) {
      console.warn('groupBy failed (older Prisma versions may not support it). Error:', e.message || e);
    }

    // Fetch rows that the list query would return
    const visibleStatusPatterns = ['pending', 'return', 'resubm', 'respond'];
    const statusOr = { OR: visibleStatusPatterns.map(p => ({ reviewStatus: { contains: p, mode: Prisma.QueryMode.insensitive } })) };

    const listWhere = { ...baseWhere, AND: [statusOr], NOT: [excludeApproved, { response: { contains: 'cancel', mode: Prisma.QueryMode.insensitive } }] };
    const inquiries = await prisma.inquiry.findMany({ where: listWhere, orderBy: { createdAt: 'desc' }, select: { id: true, reviewStatus: true, message: true, response: true, createdAt: true, user: { select: { id: true, email: true, fullName: true }, }, }, take: 200 });

    console.log(`\nList query returned ${inquiries.length} rows (take=200):`);
    inquiries.forEach(i => {
      console.log(`- id=${i.id} status=${i.reviewStatus} user=${i.user?.email || i.user?.fullName || '<unknown>'} createdAt=${i.createdAt}`);
    });

    // Also show any rows that match the pendingCount condition specifically
    const pendingWhere = { ...baseWhere, AND: [{ OR: [{ reviewStatus: { contains: 'pending', mode: Prisma.QueryMode.insensitive } }] }], NOT: [excludeCancelled, excludeApproved] };
    const pendingRows = await prisma.inquiry.findMany({ where: pendingWhere, select: { id: true, reviewStatus: true, response: true, createdAt: true, user: { select: { email: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });

    console.log(`\nPending-logic matched ${pendingRows.length} rows (take=200):`);
    pendingRows.forEach(r => console.log(`- id=${r.id} status=${r.reviewStatus} response=${r.response} user=${r.user?.email || r.user?.fullName || '<unknown>'}`));

    if (pendingCount !== inquiries.length) {
      console.warn('\nMismatch detected: aggregated pendingCount does not equal list rows length.');
      console.warn('Check soft-deleted, cancelled responses, or other filters that may exclude rows from the list.');
    } else {
      console.log('\nCounts match list length.')
    }

    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Audit script failed:', err);
    process.exit(2);
  } finally {
    try { await prisma.$disconnect(); } catch {};
  }
})();
