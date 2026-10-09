// Grade-result and impact-totals cache. Redis is an optimization, not a
// dependency — if it's unreachable, every caller in services/cache.js
// swallows the error and falls back to the uncached path, so the app keeps
// working (just slower) instead of crashing.
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => Math.min(times * 500, 5000),
  // While disconnected, fail commands immediately instead of queueing them
  // to wait out the reconnect backoff — a slow cache is worse than no cache.
  enableOfflineQueue: false,
  lazyConnect: false
});

redis.on('error', (err) => {
  console.warn(`Redis unavailable, continuing without caching: ${err.message}`);
});

module.exports = redis;
