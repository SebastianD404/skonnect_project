import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: [".env.local", ".env"] });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

const keepUserIds = [
  "f81ac2b6-f157-4dd6-81c2-ab147e5cf6bf", // aldrinacosta@gmail.com (SK_OFFICIAL)
  "b1470142-9ba5-4035-8430-454f62bae8f2", // admin@gmail.com (SUPER_ADMIN)
];

async function clearAuthUsers() {
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log("Starting auth users cleanup...");

    // List all auth users
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error("❌ Error listing users:", listError);
      process.exit(1);
    }

    if (!users || users.users.length === 0) {
      console.log("✓ No users to delete");
      return;
    }

    console.log(`Found ${users.users.length} total auth users`);

    // Filter users to delete (exclude the two admin accounts)
    const usersToDelete = users.users.filter(
      (user) => !keepUserIds.includes(user.id)
    );

    if (usersToDelete.length === 0) {
      console.log("✓ No users to delete (only admin accounts exist)");
      return;
    }

    console.log(`\nDeleting ${usersToDelete.length} user(s)...`);

    let deletedCount = 0;
    for (const user of usersToDelete) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

      if (deleteError) {
        console.error(
          `⚠ Error deleting user ${user.id} (${user.email}):`,
          deleteError
        );
      } else {
        deletedCount++;
        console.log(`  ✓ Deleted ${user.email}`);
      }
    }

    console.log(`\n✓ Deleted ${deletedCount} auth user(s)`);

    // Verify remaining users
    console.log("\nKept auth users:");
    const keepUsers = users.users.filter((user) => keepUserIds.includes(user.id));
    for (const user of keepUsers) {
      console.log(
        `  - ${user.id} (${user.email}) [${user.user_metadata?.role || "user"}]`
      );
    }
  } catch (error) {
    console.error("❌ Error clearing auth users:", error);
    process.exit(1);
  }
}

clearAuthUsers();
