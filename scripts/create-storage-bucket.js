#!/usr/bin/env node

const https = require("https");

/**
 * Creates a Supabase Storage bucket using the Management API
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Error: Missing environment variables");
  console.error("   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  console.error("\n   To get your Service Role Key:");
  console.error("   1. Go to https://app.supabase.com/");
  console.error("   2. Select your project");
  console.error("   3. Settings → API → Service Role Key (copy it)");
  console.error("   4. Add to your .env file: SUPABASE_SERVICE_ROLE_KEY=<your-key>");
  process.exit(1);
}

const projectId = SUPABASE_URL.split("//")[1].split(".")[0];

async function createBucket() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      name: "public",
      public: true,
    });

    const options = {
      hostname: `${projectId}.supabase.co`,
      path: "/storage/v1/bucket",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    };

    console.log(`📝 Creating bucket "public" on ${projectId}.supabase.co...`);

    const req = https.request(options, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log("✅ Bucket created successfully!");
          resolve(true);
        } else if (res.statusCode === 400 && body.includes("already exists")) {
          console.log("✅ Bucket already exists!");
          resolve(true);
        } else {
          console.error(`❌ Error (${res.statusCode}):`, body);
          reject(new Error(`Failed to create bucket: ${body}`));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

createBucket()
  .then(() => {
    console.log("\n✨ Storage bucket setup complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Setup failed:", error.message);
    process.exit(1);
  });
