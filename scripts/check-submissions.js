const path = require('path');
const prismaPath = path.join(__dirname, '..', 'lib', 'prisma.js');
const { prisma } = require(prismaPath);

async function main() {
  const semesterArg = process.argv[2] || '2026-2027 First Semester';
  const sem = String(semesterArg).replace(/\s*\(Current\)$/i, '').trim();
  console.log('Checking semester:', sem);

  try {
    const subCount = await prisma.submission.count({
      where: { semester: { contains: sem, mode: 'insensitive' } },
    });

    console.log('submission count matching semester (contains, case-insensitive):', subCount);

    const subs = await prisma.submission.findMany({
      where: { semester: { contains: sem, mode: 'insensitive' } },
      orderBy: { submittedAt: 'desc' },
      take: 10,
      select: { id: true, granteeId: true, semester: true, status: true, submittedAt: true },
    });

    console.log('sample submissions:', subs);

    const granteeCount = await prisma.grantee.count({
      where: { submissions: { some: { semester: { contains: sem, mode: 'insensitive' } } } },
    });
    console.log('grantees with submissions for semester (count):', granteeCount);

    const grantees = await prisma.grantee.findMany({
      where: { submissions: { some: { semester: { contains: sem, mode: 'insensitive' } } } },
      include: { user: true, submissions: { where: { semester: { contains: sem, mode: 'insensitive' } }, take: 1, orderBy: { submittedAt: 'desc' } } },
      take: 20,
    });

    console.log('sample grantees:', grantees.map(g => ({ id: g.id, name: g.user?.fullName, submission: g.submissions[0] ?? null })));
  } catch (err) {
    console.error('ERROR', err && err.message ? err.message : String(err));
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

main();
