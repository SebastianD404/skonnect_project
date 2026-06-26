#!/usr/bin/env node

/**
 * Setup RLS Policies for Supabase Storage
 * This script creates RLS policies for the "public image" bucket
 */

const https = require('https');

const projectUrl = 'https://ehroxahawcwmltatrcto.supabase.co';
const serviceRoleKey = 'sb_secret_Vmr33NngElCHVawpW0jQ2A_rmgNit6d';

// SQL to create policies
const policies = [
  {
    name: 'Allow authenticated users to upload',
    definition: `bucket_id = 'public image' AND auth.role() = 'authenticated'`,
    operation: 'INSERT'
  },
  {
    name: 'Allow public read access',
    definition: `bucket_id = 'public image'`,
    operation: 'SELECT'
  }
];

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(projectUrl + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers
          });
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
    // Create INSERT policy
    console.log('📝 Creating INSERT policy for authenticated users...');
    const insertPolicy = {
      name: 'Allow authenticated upload',
      definition: `bucket_id = 'public image' AND auth.role() = 'authenticated'`,
      roles: ['authenticated'],
      command: 'INSERT',
      as_owner: true
    };

    const insertRes = await makeRequest(
      'POST',
      '/rest/v1/storage/policies?bucket_id=public%20image',
      insertPolicy
    );

    if (insertRes.status === 201 || insertRes.status === 200) {
      console.log('✅ INSERT policy created successfully\n');
    } else {
      console.log('⚠️  INSERT policy response:', insertRes.status, insertRes.data, '\n');
    }

    // Create SELECT policy
    console.log('📝 Creating SELECT policy for public read...');
    const selectPolicy = {
      name: 'Allow public read',
      definition: `bucket_id = 'public image'`,
      roles: ['public'],
      command: 'SELECT',
      as_owner: false
    };

    const selectRes = await makeRequest(
      'POST',
      '/rest/v1/storage/policies?bucket_id=public%20image',
      selectPolicy
    );

    if (selectRes.status === 201 || selectRes.status === 200) {
      console.log('✅ SELECT policy created successfully\n');
    } else {
      console.log('⚠️  SELECT policy response:', selectRes.status, selectRes.data, '\n');
    }

    console.log('🎉 RLS policies setup complete!');
    console.log('\nYour image upload should now work. Try uploading an event image from the admin dashboard.');

  } catch (error) {
    console.error('❌ Error setting up policies:', error.message);
    process.exit(1);
  }
}

setupPolicies();
