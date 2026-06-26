#!/usr/bin/env node

/**
 * Setup RLS Policies using Supabase Admin API
 */

const { createClient } = require('@supabase/supabase-js');

const projectUrl = 'https://ehroxahawcwmltatrcto.supabase.co';
const serviceRoleKey = 'sb_secret_Vmr33NngElCHVawpW0jQ2A_rmgNit6d';

const supabase = createClient(projectUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupPolicies() {
  console.log('🔧 Setting up RLS policies for "public image" bucket...\n');

  try {
    // Check if bucket exists
    console.log('📦 Checking bucket status...');
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'public image');
    
    if (!bucketExists) {
      console.log('❌ Bucket "public image" not found!');
      process.exit(1);
    }
    console.log('✅ Bucket "public image" found\n');

    // Create policies using SQL
    console.log('📝 Creating RLS policies...');
    
    // Note: Policies must be created through SQL, not REST API
    // The script will show what needs to be done in Supabase SQL Editor
    
    const policies = `
-- Enable RLS on storage.objects table (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to INSERT (upload) files to public image bucket
CREATE POLICY "Allow authenticated users to upload to public image"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'public image' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow anyone to SELECT (read) files from public image bucket
CREATE POLICY "Allow public read from public image"
ON storage.objects FOR SELECT
USING (bucket_id = 'public image');
`;

    console.log('✅ RLS policies code generated!\n');
    console.log('📋 Copy the SQL below and run it in your Supabase SQL Editor:\n');
    console.log('═'.repeat(60));
    console.log(policies);
    console.log('═'.repeat(60));
    console.log('\nSteps:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Click "New Query"');
    console.log('3. Paste the SQL above');
    console.log('4. Click "Run"');
    console.log('\nAfter that, your image uploads should work! ✨');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupPolicies();
