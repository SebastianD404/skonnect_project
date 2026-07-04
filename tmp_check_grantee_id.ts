import "dotenv/config";
import { prisma } from "./lib/prisma";

async function main() {
  const id = "af353155-c74f-45d2-ac31-0056b1a4d858";
  const grantee = await prisma.grantee.findUnique({ where: { id } });
  console.log("id:", id);
  console.log("found:", grantee !== null);
  if (grantee) {
    console.log(JSON.stringify(grantee, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
