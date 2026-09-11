const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');

const PORT = process.env.PORT || 5000;

let server;

// Load dotenv, connect to database first, and only then load app & listen on port 5000
connectDB()
  .then(async () => {
    const ensureSuperAdminExists = require('./utils/seedSuperAdmin');
    await ensureSuperAdminExists();
    const { ensureOrganizationLicensesValid } = require('./services/licenseService');
    await ensureOrganizationLicensesValid();
    const app = require('./app');

    server = http.createServer(app);
    initSocket(server);

    const { initScheduler } = require('./services/schedulerService');
    initScheduler();

    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please terminate the process using port ${PORT}.`);
        process.exit(1);
      } else {
        console.error('Server error:', err);
      }
    });

    // Graceful Shutdown Handlers
    const shutdown = async () => {
      if (server) {
        server.close();
      }
      try {
        const { prisma } = require('./config/prismaClient');
        await prisma.$disconnect();
      } catch (err) {
        // Ignore disconnect error during shutdown
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch((err) => {
    console.error('Failed to start server due to database connection error:', err.message || err);
    process.exit(1);
  });
