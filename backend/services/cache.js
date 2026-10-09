// Thin Redis read/write helpers. Every call is wrapped so a Redis outage
// degrades to "no caching" instead of failing the request.
const redis = require('../database/redis');

async function getCached(key) {
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn(`Cache read failed for "${key}": ${e.message}`);
    return null;
  }
}

async function setCached(key, value, ttlSeconds) {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (e) {
    console.warn(`Cache write failed for "${key}": ${e.message}`);
  }
}

module.exports = { getCached, setCached };
