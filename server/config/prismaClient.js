require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

let prisma;

const createPrismaClient = () => {
  const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const baseClient = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    },
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' }
    ]
  });

  baseClient.$on('warn', (e) => {
    if (e.message && e.message.includes('kind: Closed')) return;
  });

  const extendedClient = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          let attempts = 0;
          const maxRetries = 5;
          const retryDelays = [500, 1000, 1500, 2500, 3500];

          while (true) {
            try {
              const start = Date.now();
              const result = await query(args);
              const duration = Date.now() - start;
              if (duration >= 50) {
                console.log(`[DB PERF] ${model}.${operation} - ${duration} ms`);
              }
              return result;
            } catch (error) {
              const errCode = error?.code || '';
              const errMsg = error?.message || '';

              const isTransientDbError =
                ['P1000', 'P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(errCode) ||
                errMsg.includes("Can't reach database server") ||
                errMsg.includes('kind: Closed') ||
                errMsg.includes('Connection reset') ||
                errMsg.includes('ECONNRESET') ||
                errMsg.includes('ETIMEDOUT') ||
                errMsg.includes('socket hang up') ||
                errMsg.includes('EngineNotStarted');

              if (isTransientDbError && attempts < maxRetries) {
                const delay = retryDelays[attempts] || 1500;
                attempts++;
                console.warn(`[Neon DB Retry] Transient connection issue (${errCode || 'network'}) during ${model}.${operation}, attempt ${attempts}/${maxRetries}. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
              throw error;
            }
          }
        }
      }
    }
  });

  return extendedClient;
};

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }
  prisma = global.prisma;
}

/**
 * Fast in-place object transformer to attach `_id` matching `id` for 100% frontend API contract compatibility.
 */
function withId(data) {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(withId);
  }
  if (typeof data === 'object') {
    if (data instanceof Date || Buffer.isBuffer(data)) return data;

    if (data.id !== undefined && data._id === undefined) {
      data._id = data.id;
    }

    for (const key of Object.keys(data)) {
      const val = data[key];
      if (val && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
        withId(val);
      }
    }
    return data;
  }
  return data;
}

module.exports = {
  prisma,
  withId
};
