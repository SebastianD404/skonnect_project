const { prisma } = require('./lib/prisma');
(async () => {
  try {
    console.log('prisma client imported');
    const result = await prisma.inquiry.findMany({
      where: {
        subject: { contains: 'SKEAP application', mode: 'insensitive' },
        NOT: [{ reviewStatus: { contains: 'cancel', mode: 'insensitive' } }],
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
    console.log('result', result);
  } catch (err) {
    console.error('query failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
