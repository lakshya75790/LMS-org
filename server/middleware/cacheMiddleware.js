const { getRedisCache, setRedisCache, delRedisCache } = require('../config/redisClient');

const responseCache = new Map();
const DEFAULT_SERVER_TTL = 10000; // 10 seconds default

const cacheMiddleware = (durationMs = DEFAULT_SERVER_TTL) => {
  return async (req, res, next) => {
    if (req.method !== 'GET' || !req.user) {
      return next();
    }

    // Never cache authentication, passwords, or OTP endpoints
    const url = req.originalUrl || req.url || '';
    if (url.includes('/auth/login') || url.includes('/auth/otp') || url.includes('/auth/me')) {
      return next();
    }

    const orgId = String(req.user.organizationId?.id || req.user.organizationId?._id || req.user.organizationId || 'public');
    const userId = String(req.user.id || req.user._id || 'guest');
    const role = String(req.user.role || 'none');
    const key = `lms:${orgId}:${userId}:${role}:${url}`;

    // 1. Check local memory cache (ultra fast ~0ms)
    const cachedMemory = responseCache.get(key);
    if (cachedMemory && (Date.now() - cachedMemory.timestamp < durationMs)) {
      res.setHeader('X-Server-Cache', 'MEM_HIT');
      return res.status(cachedMemory.status).json(cachedMemory.body);
    }

    // 2. Check Upstash Redis cache
    const cachedRedis = await getRedisCache(key);
    if (cachedRedis && cachedRedis.body) {
      // Seed memory cache for fast repeat reads
      responseCache.set(key, {
        timestamp: Date.now(),
        status: cachedRedis.status || 200,
        body: cachedRedis.body
      });
      res.setHeader('X-Server-Cache', 'REDIS_HIT');
      return res.status(cachedRedis.status || 200).json(cachedRedis.body);
    }

    // Intercept JSON response to write to caches
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        responseCache.set(key, {
          timestamp: Date.now(),
          status: res.statusCode,
          body
        });

        // Set in Redis asynchronously with TTL in seconds
        const ttlSeconds = Math.max(1, Math.ceil(durationMs / 1000));
        setRedisCache(key, { status: res.statusCode, body }, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
};

const invalidateServerCache = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const url = req.originalUrl || req.url || '';
    if (!url.includes('/notifications') && !url.includes('/progress') && !url.includes('/status') && !url.includes('/auto-rules')) {
      responseCache.clear();
    }
  }
  next();
};

module.exports = {
  cacheMiddleware,
  invalidateServerCache
};
