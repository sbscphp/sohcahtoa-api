import { PrismaClient } from '@prisma/client';
import { createLogger, ServiceName } from '@fx-platform/shared-utils';

const logger = createLogger(ServiceName.AUTH);

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

prisma.$on('query' as any, (e: any) => {
  logger.debug(`Query: ${e.query}`);
  logger.debug(`Params: ${e.params}`);
  logger.debug(`Duration: ${e.duration}ms`);
});

prisma.$on('error' as any, (e: any) => {
  logger.error('Prisma error:', e);
});

prisma.$on('warn' as any, (e: any) => {
  logger.warn('Prisma warning:', e);
});

export default prisma;
