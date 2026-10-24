import { LRUCache } from "lru-cache";

const CHAT_RATE_LIMIT = 10;
const CHAT_RATE_WINDOW_MS = 60_000;

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

const requestsByIp = new LRUCache<string, RateLimitEntry>({
  max: 50_000,
  ttl: CHAT_RATE_WINDOW_MS,
});

export function checkChatIpRateLimit(ip: string, now = Date.now()) {
  const current = requestsByIp.get(ip);

  if (!current || current.expiresAt <= now) {
    requestsByIp.set(ip, {
      count: 1,
      expiresAt: now + CHAT_RATE_WINDOW_MS,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= CHAT_RATE_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
    };
  }

  requestsByIp.set(
    ip,
    { ...current, count: current.count + 1 },
    { ttl: Math.max(1, current.expiresAt - now) }
  );
  return { allowed: true, retryAfterSeconds: 0 };
}
