require('dotenv').config();
const { Redis } = require('@upstash/redis');

let redis = null;
let isRedisEnabled = false;

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN;

if (url && token && !url.includes('YOUR_UPSTASH') && !token.includes('YOUR_UPSTASH')) {
  try {
    redis = new Redis({ url, token });
    isRedisEnabled = true;
    console.log('[Redis] Upstash Redis client initialized successfully.');
  } catch (err) {
    console.warn('[Redis Warning] Failed to initialize Upstash Redis client. Falling back to memory cache:', err.message);
    redis = null;
    isRedisEnabled = false;
  }
} else {
  console.log('[Redis] Upstash Redis credentials not configured. Operating with high-performance memory cache fallback.');
}

/**
 * Get cached object from Upstash Redis with error boundary
 */
async function getRedisCache(key) {
  if (!isRedisEnabled || !redis) return null;
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (err) {
    console.warn(`[Redis Error] GET failed for key "${key}":`, err.message);
    return null;
  }
}

/**
 * Set cached object in Upstash Redis with TTL and error boundary
 */
async function setRedisCache(key, value, ttlSeconds = 30) {
  if (!isRedisEnabled || !redis) return false;
  try {
    const payload = JSON.stringify(value);
    await redis.set(key, payload, { ex: Math.max(1, Math.floor(ttlSeconds)) });
    return true;
  } catch (err) {
    console.warn(`[Redis Error] SET failed for key "${key}":`, err.message);
    return false;
  }
}

/**
 * Delete key from Upstash Redis with error boundary
 */
async function delRedisCache(key) {
  if (!isRedisEnabled || !redis) return false;
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    console.warn(`[Redis Error] DEL failed for key "${key}":`, err.message);
    return false;
  }
}

module.exports = {
  redis,
  isRedisEnabled,
  getRedisCache,
  setRedisCache,
  delRedisCache
};
