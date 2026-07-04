require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const id = 'af353155-c74f-45d2-ac31-0056b1a4d858';
    const grantee = await prisma.grantee.findUnique({ where: { id } });
    console.log('id:', id);
    console.log('grantee:', grantee ? { id: grantee.id, userId: grantee.userId, school: grantee.school } : null);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
