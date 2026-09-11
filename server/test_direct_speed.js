require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const pooledUrl = "postgresql://neondb_owner:npg_ZAREBiK6f3DM@ep-round-leaf-azowx3ov-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=30&pool_timeout=30&connection_limit=10";
const directUrl = "postgresql://neondb_owner:npg_ZAREBiK6f3DM@ep-round-leaf-azowx3ov.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15&pool_timeout=30&connection_limit=10";

async function test(url, label) {
  const client = new PrismaClient({
    datasources: { db: { url } }
  });
  try {
    await client.$connect();

    // Measure 5 consecutive queries
    const start = Date.now();
    await client.user.findMany({ take: 10 });
    await client.department.findMany({ take: 10 });
    await client.training.findMany({ take: 10 });
    await client.auditLog.findMany({ take: 10 });
    await client.notification.findMany({ take: 10 });
    const duration = Date.now() - start;

    console.log(`[RESULTS] ${label}: 5 Queries finished in ${duration}ms (Avg ${Math.round(duration/5)}ms/query)`);
    await client.$disconnect();
  } catch (err) {
    console.error(`[FAIL] ${label}:`, err.message);
    await client.$disconnect();
  }
}

async function run() {
  console.log('--- COMPARING POOLED VS DIRECT NEON EXECUTION SPEED ---');
  await test(pooledUrl, 'Pooled PgBouncer URL (-pooler)');
  await test(directUrl, 'Direct Compute Endpoint URL');
}

run();
