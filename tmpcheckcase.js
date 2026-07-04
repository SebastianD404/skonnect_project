require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL });
  await client.connect();
  const queries = [
    "SELECT count(*) FROM public.skeap_applications",
    "SELECT \"mothersContact\" FROM public.skeap_applications LIMIT 1",
    "SELECT mothersContact FROM public.skeap_applications LIMIT 1",
    "SELECT \"motherscontact\" FROM public.skeap_applications LIMIT 1",
    "SELECT \"uploadedFiles\" FROM public.skeap_applications LIMIT 1",
    "SELECT uploadedFiles FROM public.skeap_applications LIMIT 1"
  ];
  for (const q of queries) {
    try {
      const res = await client.query(q);
      console.log('OK:', q, '->', res.rows.length, 'rows');
    } catch (err) {
      console.log('ERR:', q, err.message);
    }
  }
  await client.end();
})();
