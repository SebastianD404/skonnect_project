#!/usr/bin/env node

/**
 * Setup RLS Policies using Supabase JS Client + Admin API
 */

const { createClient } = require('@supabase/supabase-js');

const PROJECT_URL = 'https://ehroxahawcwmltatrcto.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_Vmr33NngElCHVawpW0jQ2A_rmgNit6d';
const BUCKET_ID = 'public image';

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupPolicies() {
  console.log('🔧 Setting up RLS policies for "public image" bucket...\n');

  try {
    // Verify bucket exists first
    console.log('📦 Verifying bucket exists...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError);
      process.exit(1);
    }

    const bucketExists = buckets?.some(b => b.name === BUCKET_ID);
    if (!bucketExists) {
      console.error(`❌ Bucket "${BUCKET_ID}" not found!`);
      process.exit(1);
    }
    console.log(`✅ Bucket "${BUCKET_ID}" exists\n`);

    // Create policies using SQL through Supabase
    console.log('📝 Creating RLS policies via SQL...');
    
    const sql = `
-- Enable RLS on storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to INSERT (upload)
DROP POLICY IF EXISTS "Allow authenticated users to upload to public image" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload to public image"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = '${BUCKET_ID}' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow public read (SELECT)
DROP POLICY IF EXISTS "Allow public read from public image" ON storage.objects;
CREATE POLICY "Allow public read from public image"
ON storage.objects FOR SELECT
USING (bucket_id = '${BUCKET_ID}');
`;

    const { error: sqlError } = await supabase.rpc('exec_sql', {
      sql_query: sql
    }).catch(() => ({ error: { message: 'RPC not available' } }));

    // If RPC fails, try direct SQL approach
    if (sqlError) {
      console.log('⚠️  RPC method not available, trying direct database connection...\n');
      
      // Alternative: Use the REST API with raw SQL
      console.log('📋 SQL policies to create manually:\n');
      console.log('═'.repeat(70));
      console.log(sql);
      console.log('═'.repeat(70));
      console.log('\n📌 Steps to apply:');
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Click "New Query"');
      console.log('3. Paste the SQL above');
      console.log('4. Click "Run"');
      console.log('\n✅ After running the SQL, image uploads will work!\n');
    } else {
      console.log('✅ RLS policies created successfully!\n');
      console.log('🎉 Your image upload should now work.');
      console.log('Try uploading an event image from the admin dashboard.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupPolicies();
