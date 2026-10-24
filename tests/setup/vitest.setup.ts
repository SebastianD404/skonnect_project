// Provide test environment variables and lightweight stubs
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "./prisma-mock";

afterEach(() => {
  cleanup();
});

const env = process.env as unknown as Record<string, string | undefined>;
env.DATABASE_URL = env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/testdb';
if (env.NODE_ENV !== 'test') {
  env.NODE_ENV = 'test';
}
