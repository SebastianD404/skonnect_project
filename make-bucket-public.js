#!/usr/bin/env node

/**
 * Make Supabase bucket public
 */

const https = require('https');

const PROJECT_URL = 'https://ehroxahawcwmltatrcto.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_Vmr33NngElCHVawpW0jQ2A_rmgNit6d';
const BUCKET_ID = 'public image';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(PROJECT_URL + path);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function makeBucketPublic() {
  console.log('🔓 Making bucket public...\n');

  try {
    // Update bucket to public
    console.log(`📝 Setting "public image" bucket to PUBLIC access...`);
    
    const updatePayload = {
      public: true
    };

    const res = await makeRequest(
      'PATCH',
      `/storage/v1/buckets/${encodeURIComponent(BUCKET_ID)}`,
      updatePayload
    );

    console.log(`Response Status: ${res.status}`);
    console.log(`Response:`, JSON.stringify(res.data, null, 2));

    if (res.status === 200 || (res.status === 201 && res.data.id)) {
      console.log('\n✅ Bucket is now PUBLIC!');
      console.log('🎉 Images should now load correctly!');
      console.log('\nRefresh your browser to see the images.\n');
    } else {
      console.log('\n⚠️  Response received, but status unclear.');
      console.log('Try manually making the bucket public:');
      console.log('1. Go to Supabase Dashboard → Storage → Buckets');
      console.log('2. Click "public image" → Settings');
      console.log('3. Toggle "Allow public access" ON');
      console.log('4. Save\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nManual fix:');
    console.log('1. Go to https://supabase.com/dashboard/project/ehroxahawcwmltatrcto/storage/buckets');
    console.log('2. Click "public image" bucket');
    console.log('3. Click Settings (gear icon)');
    console.log('4. Change "Access level" to "Public"');
    console.log('5. Save');
    process.exit(1);
  }
}

makeBucketPublic();
