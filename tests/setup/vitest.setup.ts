// Provide test environment variables and lightweight stubs
const env = process.env as unknown as Record<string, string | undefined>;
env.DATABASE_URL = env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/testdb';
if (env.NODE_ENV !== 'test') {
  env.NODE_ENV = 'test';
}
