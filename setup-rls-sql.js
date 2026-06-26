#!/usr/bin/env node

/**
 * Setup RLS Policies - Display SQL for manual execution
 */

const BUCKET_ID = 'public image';

const sql = `-- Enable RLS on storage.objects table
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
USING (bucket_id = '${BUCKET_ID}');`;

console.log('🔧 RLS Policy Setup for Supabase\n');
console.log('═'.repeat(80));
console.log(sql);
console.log('═'.repeat(80));
console.log('\n📋 HOW TO APPLY:\n');
console.log('1. Go to: https://supabase.com/dashboard/project/ehroxahawcwmltatrcto/sql/new');
console.log('2. Paste the SQL above into the editor');
console.log('3. Click the "Run" button');
console.log('4. You should see "Success" messages\n');
console.log('✅ After running, your image uploads will work!\n');
