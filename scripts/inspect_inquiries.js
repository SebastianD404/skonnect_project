const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const rows = await prisma.inquiry.findMany({
      where: { subject: { contains: 'SKEAP application', mode: 'insensitive' } },
      select: {
        id: true,
        subject: true,
        reviewStatus: true,
        response: true,
        isResolved: true,
        createdAt: true,
        userId: true,
      },
    });
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
