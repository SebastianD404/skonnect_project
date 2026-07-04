import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  try {
    // Find Luna's user account
    const user = await prisma.user.findUnique({
      where: { email: "luna.damugo@example.com" },
      include: { grantee: true },
    });

    if (!user || !user.grantee) {
      console.log("Luna not found");
      return;
    }

    // Get all submissions for this grantee grouped by semester
    const submissions = await prisma.submission.findMany({
      where: { granteeId: user.grantee.id },
      orderBy: [{ semester: "asc" }, { submittedAt: "desc" }],
    });

    console.log(`Found ${submissions.length} total submissions for Luna`);

    // Group by semester
    const bySemester = new Map<string, typeof submissions>();
    for (const sub of submissions) {
      if (!bySemester.has(sub.semester)) {
        bySemester.set(sub.semester, []);
      }
      bySemester.get(sub.semester)!.push(sub);
    }

    let deletedCount = 0;

    // For each semester with duplicates, keep the best one and delete others
    for (const [semester, subs] of bySemester) {
      if (subs.length > 1) {
        console.log(`\nSemester: ${semester} (${subs.length} records)`);

        // Keep the one with gradeFileUrl, or the most recent
        const withGrades = subs.find((s) => s.gradeFileUrl);
        const toKeep = withGrades || subs[0];
        const toDelete = subs.filter((s) => s.id !== toKeep.id);

        console.log(`  Keeping: ${toKeep.id} (gradeFileUrl: ${!!toKeep.gradeFileUrl}, status: ${toKeep.status})`);

        for (const sub of toDelete) {
          console.log(`  Deleting: ${sub.id} (gradeFileUrl: ${!!sub.gradeFileUrl}, status: ${sub.status})`);
          await prisma.submission.delete({ where: { id: sub.id } });
          deletedCount++;
        }
      }
    }

    console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} duplicate submission(s)`);
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicates();
