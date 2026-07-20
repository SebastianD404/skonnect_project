import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: [".env.local", ".env"] });

const urlFromEnv = process.env.DIRECT_URL || process.env.DATABASE_URL || env("DIRECT_URL") || env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: urlFromEnv,
  },
});