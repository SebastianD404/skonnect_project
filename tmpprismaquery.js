require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('query', (e) => {
  console.log('QUERY:', e.query);
  console.log('PARAMS:', e.params);
});
prisma.$on('error', (e) => {
  console.error('PRISMA ERROR:', e);
});

(async () => {
  try {
    const result = await prisma.inquiry.findMany({
      where: {
        subject: { contains: 'SKEAP application', mode: Prisma.QueryMode.insensitive },
        NOT: [{ reviewStatus: { contains: 'cancel', mode: Prisma.QueryMode.insensitive } }],
      },
      select: {
        id: true,
        application: {
          select: {
            currentCourse: true,
            fathersContact: true,
            mothersContact: true,
            uploadedFiles: true,
          },
        },
      },
      take: 1,
    });
    console.log('query succeeded', result.length);
    console.dir(result, { depth: 5 });
  } catch (err) {
    console.error('query failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
