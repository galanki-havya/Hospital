import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import prisma from './config/prisma.js';

async function startServer() {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');
  } catch (err) {
    logger.error(`❌ Failed to connect to database: ${err.message}`);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 MediCore HMS API running on port ${env.PORT} (${env.NODE_ENV})`);
    logger.info(`📋 Health: http://localhost:${env.PORT}/health`);
    logger.info(`🔑 API:    http://localhost:${env.PORT}/api/v1`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Database disconnected');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logger.error(`Unhandled rejection: ${err}`));
}

startServer();
