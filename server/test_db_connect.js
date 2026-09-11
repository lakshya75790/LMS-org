require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

console.log('Testing DATABASE_URL connection string format...');

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Attempting prisma.$connect()...');
    await prisma.$connect();
    console.log('SUCCESS! Prisma connected to Neon PostgreSQL successfully!');
    const userCount = await prisma.user.count();
    console.log('User count in DB:', userCount);
    await prisma.$disconnect();
  } catch (err) {
    console.error('FAILED to connect:', err.message);
    await prisma.$disconnect();
  }
}

test();
