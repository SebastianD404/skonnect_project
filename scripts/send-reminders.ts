import "dotenv/config";
import { prisma } from "../lib/prisma";
import { runDeadlineReminders } from "../lib/deadline-reminder-runner";

export {
  loadReminderSettings,
  processSkeapReminders,
  sendReminderLogs,
} from "../lib/deadline-reminder-runner";

if (require.main === module) {
  runDeadlineReminders()
    .then((result) => {
      console.log("Deadline reminder run completed:", result);
    })
    .catch((error) => {
      console.error("Reminder runner failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
