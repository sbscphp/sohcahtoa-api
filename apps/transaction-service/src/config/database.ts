import { PrismaClient } from '@prisma/client';
import { createLogger, ServiceName } from '@fx-platform/shared-utils';

const logger = createLogger(ServiceName.TRANSACTION);

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

prisma.$on('query' as any, (e: any) => {
  logger.debug(`Query: ${e.query}`);
});

prisma.$on('error' as any, (e: any) => {
  logger.error('Prisma error:', e);
});

export default prisma;
