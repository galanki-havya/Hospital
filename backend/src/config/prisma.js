import { PrismaClient } from '@prisma/client';
import { isProd } from './env.js';

/**
 * Singleton Prisma client. In dev, we attach it to globalThis to survive
 * --watch hot-reloads without exhausting MySQL connections.
 */
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: isProd ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!isProd) {
  globalForPrisma.__prisma = prisma;
}

export default prisma;
