require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const pooledUrl = process.env.DATABASE_URL;
// Compute direct URL by removing '-pooler' from hostname and stripping 'channel_binding=require'
const directUrl = pooledUrl
  .replace('-pooler.', '.')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require', '');

console.log('--- NEON DIAGNOSTIC CONNECTION TEST ---');
console.log('1. Testing Current Pooled DATABASE_URL...');

async function testUrl(url, label) {
  const client = new PrismaClient({
    datasources: {
      db: { url }
    }
  });

  try {
    const start = Date.now();
    await client.$connect();
    const duration = Date.now() - start;
    const count = await client.user.count();
    console.log(`[SUCCESS] ${label} connected in ${duration}ms! Users count: ${count}`);
    await client.$disconnect();
    return true;
  } catch (err) {
    console.error(`[FAILED] ${label}:`, err.message);
    await client.$disconnect();
    return false;
  }
}

async function run() {
  await testUrl(pooledUrl, 'Pooled URL (-pooler)');
  await testUrl(directUrl, 'Direct URL (non-pooler)');
  
  // Also test with connect_timeout
  const directUrlWithTimeout = directUrl.includes('?') 
    ? `${directUrl}&connect_timeout=15` 
    : `${directUrl}?connect_timeout=15`;
  await testUrl(directUrlWithTimeout, 'Direct URL with connect_timeout=15');
}

run();
