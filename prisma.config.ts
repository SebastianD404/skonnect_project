import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config();

export default defineConfig({
  schema: "schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});