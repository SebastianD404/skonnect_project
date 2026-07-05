import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: [".env.local", ".env"] });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

async function checkAuthUsers() {
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log("Checking remaining auth users...\n");

    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error("❌ Error listing users:", listError);
      process.exit(1);
    }

    if (!users || users.users.length === 0) {
      console.log("⚠ No users found in auth system");
      return;
    }

    console.log(`Total auth users: ${users.users.length}\n`);
    for (const user of users.users) {
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`---`);
    }
  } catch (error) {
    console.error("❌ Error checking auth users:", error);
    process.exit(1);
  }
}

checkAuthUsers();
