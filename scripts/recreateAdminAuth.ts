import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: [".env.local", ".env"] });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

const adminAccounts = [
  {
    id: "f81ac2b6-f157-4dd6-81c2-ab147e5cf6bf",
    email: "aldrinacosta@gmail.com",
    password: "SK_OFFICIAL_PASSWORD_123",
  },
  {
    id: "b1470142-9ba5-4035-8430-454f62bae8f2",
    email: "admin@gmail.com",
    password: "SUPER_ADMIN_PASSWORD_123",
  },
];

async function recreateAuthUsers() {
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log("Recreating auth accounts for admin users...\n");

    for (const account of adminAccounts) {
      const { data, error } = await supabase.auth.admin.createUser({
        user_metadata: {
          role: account.email.includes("aldrinacosta") ? "SK_OFFICIAL" : "SUPER_ADMIN",
        },
        email: account.email,
        password: account.password,
        email_confirm: true,
      });

      if (error) {
        console.error(`❌ Error creating user ${account.email}:`, error.message);
      } else {
        console.log(`✓ Recreated auth account: ${account.email}`);
        if (data.user) {
          console.log(`  Auth ID: ${data.user.id}`);
        }
      }
    }

    console.log("\n✓ Admin auth accounts have been recreated");
  } catch (error) {
    console.error("❌ Error recreating auth users:", error);
    process.exit(1);
  }
}

recreateAuthUsers();
