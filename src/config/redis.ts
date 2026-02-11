import Redis from 'ioredis';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('Redis');

let redisClient: Redis | null = null;

export const initializeRedis = (): Redis => {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    logger.info(`Initializing Redis connection to: ${redisUrl}`);

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 10) {
          logger.error('Redis connection failed after 10 retries');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 3000);
        logger.info(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err) => {
        logger.warn('Redis reconnect on error:', err.message);
        const targetErrors = ['READONLY', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
        return targetErrors.some(error => err.message.includes(error));
      },
      lazyConnect: false,
      showFriendlyErrorStack: true,
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('ready', () => {
      logger.info('Redis is ready to accept commands');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err.message);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient.on('reconnecting', (delay: number) => {
      logger.info(`Redis reconnecting in ${delay}ms...`);
    });

    redisClient.on('end', () => {
      logger.warn('Redis connection ended');
    });
  }

  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

export const getRedis = (): Redis => {
  if (!redisClient) {
    return initializeRedis();
  }
  return redisClient;
};

/**
 * Cache utilities
 */
export const cache = {
  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },

  /**
   * Set a value in cache with optional TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const redis = getRedis();
    const serialized = JSON.stringify(value);

    if (ttl) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
  },

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<void> {
    const redis = getRedis();
    await redis.del(key);
  },

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const redis = getRedis();
    const result = await redis.exists(key);
    return result === 1;
  },

  /**
   * Set a value with expiry
   */
  async setex(key: string, seconds: number, value: any): Promise<void> {
    const redis = getRedis();
    const serialized = JSON.stringify(value);
    await redis.setex(key, seconds, serialized);
  },

  /**
   * Get TTL of a key
   */
  async ttl(key: string): Promise<number> {
    const redis = getRedis();
    return await redis.ttl(key);
  },

  /**
   * Increment a value
   */
  async incr(key: string): Promise<number> {
    const redis = getRedis();
    return await redis.incr(key);
  },

  /**
   * Decrement a value
   */
  async decr(key: string): Promise<number> {
    const redis = getRedis();
    return await redis.decr(key);
  },
};
