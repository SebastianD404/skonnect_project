#!/usr/bin/env node

/**
 * Setup RLS Policies using Supabase Admin API
 * Uses Service Role Key to create storage policies
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

async function setupPolicies() {
  console.log('🔧 Setting up RLS policies for "public image" bucket...\n');

  try {
    // Policy 1: Allow authenticated users to INSERT
    console.log('📝 Creating INSERT policy for authenticated users...');
    const insertPolicy = {
      name: 'Allow authenticated users to upload to public image',
      definition: `bucket_id = '${BUCKET_ID}' AND auth.role() = 'authenticated'`,
      check: `bucket_id = '${BUCKET_ID}' AND auth.role() = 'authenticated'`,
      roles: ['authenticated'],
      command: 'INSERT'
    };

    const insertRes = await makeRequest(
      'POST',
      `/rest/v1/storage/policies?bucket_id=${encodeURIComponent(BUCKET_ID)}`,
      insertPolicy
    );

    if (insertRes.status === 201 || insertRes.status === 200) {
      console.log('✅ INSERT policy created!\n');
    } else {
      console.log(`⚠️  INSERT policy response (${insertRes.status}):`, insertRes.data, '\n');
    }

    // Policy 2: Allow public to SELECT
    console.log('📝 Creating SELECT policy for public read...');
    const selectPolicy = {
      name: 'Allow public read from public image',
      definition: `bucket_id = '${BUCKET_ID}'`,
      check: `bucket_id = '${BUCKET_ID}'`,
      roles: ['public', 'authenticated'],
      command: 'SELECT'
    };

    const selectRes = await makeRequest(
      'POST',
      `/rest/v1/storage/policies?bucket_id=${encodeURIComponent(BUCKET_ID)}`,
      selectPolicy
    );

    if (selectRes.status === 201 || selectRes.status === 200) {
      console.log('✅ SELECT policy created!\n');
    } else {
      console.log(`⚠️  SELECT policy response (${selectRes.status}):`, selectRes.data, '\n');
    }

    console.log('🎉 RLS policies setup complete!');
    console.log('Your image upload should now work. Try uploading an event image from the admin dashboard.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nIf this fails, manually create policies in Supabase dashboard:');
    console.log('1. Storage → "public image" → Policies tab');
    console.log('2. Add INSERT policy: bucket_id = \'public image\' AND auth.role() = \'authenticated\'');
    console.log('3. Add SELECT policy: bucket_id = \'public image\'');
    process.exit(1);
  }
}

setupPolicies();
