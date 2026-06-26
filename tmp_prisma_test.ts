import { PrismaClient } from "@prisma/client"; const prisma = new PrismaClient(); const announcement = prisma.announcement; console.log(typeof announcement);
