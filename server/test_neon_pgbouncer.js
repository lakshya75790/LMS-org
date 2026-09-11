require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const pooledWithPgbouncer = "postgresql://neondb_owner:npg_ZAREBiK6f3DM@ep-round-leaf-azowx3ov-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=30";
const directUrl = "postgresql://neondb_owner:npg_ZAREBiK6f3DM@ep-round-leaf-azowx3ov.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30";

async function test(url, label) {
  const client = new PrismaClient({
    datasources: { db: { url } }
  });
  try {
    const start = Date.now();
    await client.$connect();
    const count = await client.user.count();
    console.log(`[PASS] ${label} - connected in ${Date.now() - start}ms! User count: ${count}`);
    await client.$disconnect();
  } catch (err) {
    console.error(`[FAIL] ${label}:`, err.message);
    await client.$disconnect();
  }
}

async function run() {
  await test(pooledWithPgbouncer, 'Pooled with pgbouncer=true & connect_timeout=30');
  await test(directUrl, 'Direct URL with connect_timeout=30');
}

run();
