import { PrismaClient } from '@prisma/client';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('Database');

// Create a singleton Prisma Client instance
let prisma: PrismaClient;

export const initializeDatabase = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query' as never, (e: any) => {
        logger.debug(`Query: ${e.query}`, {
          duration: `${e.duration}ms`,
          params: e.params,
        });
      });
    }

    logger.info('Database connection initialized');
  }

  return prisma;
};

export const disconnectDatabase = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  }
};

export const getDatabase = (): PrismaClient => {
  if (!prisma) {
    return initializeDatabase();
  }
  return prisma;
};

// Export prisma instance
export { prisma };
