import { createHash } from "crypto";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 300;

class QueryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  get(key: string): T | null {
    const now = Date.now();
    const existing = this.cache.get(key);

    if (!existing) {
      return null;
    }

    if (existing.expiresAt <= now) {
      this.cache.delete(key);
      return null;
    }

    // Refresh recency for LRU behavior.
    this.cache.delete(key);
    this.cache.set(key, existing);

    return existing.value;
  }

  set(key: string, value: T, ttlMs = DEFAULT_TTL_MS) {
    const expiresAt = Date.now() + ttlMs;

    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, { value, expiresAt });

    if (this.cache.size > MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }
}

export function normalizeQuery(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildQueryHash(text: string) {
  return createHash("sha256").update(normalizeQuery(text)).digest("hex");
}

export const retrievalCache = new QueryCache<unknown>();
export const retrievalCacheTtlMs = DEFAULT_TTL_MS;
