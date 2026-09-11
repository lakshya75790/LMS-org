require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const testUrl1 = "postgresql://neondb_owner:npg_ZAREBiK6f3DM@ep-round-leaf-azowx3ov-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=30&pool_timeout=30&connection_limit=10";
const testUrl2 = "postgresql://neondb_owner:npg_ZAREBiK6f3DM@ep-round-leaf-azowx3ov.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30&pool_timeout=30&connection_limit=10";

async function test(url, label) {
  const client = new PrismaClient({
    datasources: { db: { url } }
  });
  try {
    const start = Date.now();
    await client.$connect();
    const count = await client.user.count();
    console.log(`[SUCCESS] ${label} - connected in ${Date.now() - start}ms! Users count: ${count}`);
    await client.$disconnect();
  } catch (err) {
    console.error(`[FAIL] ${label}:`, err.message);
    await client.$disconnect();
  }
}

async function run() {
  console.log('--- TESTING POOL TIMEOUT AND CONNECTION LIMIT PARAMETERS ---');
  await test(testUrl1, 'Pooled URL with pool_timeout=30 & connection_limit=10');
  await test(testUrl2, 'Direct URL with pool_timeout=30 & connection_limit=10');
}

run();
