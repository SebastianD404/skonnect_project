const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const connectionString = "postgresql://postgres.ehroxahawcwmltatrcto:202410404dbdrowssap@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: [{ level: 'query', emit: 'event' }, { level: 'error', emit: 'event' }] });
prisma.$on('query', (e) => { console.log('QUERY:', e.query); console.log('PARAMS:', e.params); });
prisma.$on('error', (e) => { console.error('PRISMA ERROR', e); });
(async () => { try { const res = await prisma.inquiry.findMany({ where: { subject: { contains: 'SKEAP application', mode: 'insensitive' }, NOT: [{ reviewStatus: { contains: 'cancel', mode: 'insensitive' } }] }, select: { id: true, application: { select: { currentCourse: true, mothersContact: true, uploadedFiles: true } } }, take: 1 }); console.log('result', res); } catch (err) { console.error('query error', err); } finally { await prisma.$disconnect(); await pool.end(); }})();