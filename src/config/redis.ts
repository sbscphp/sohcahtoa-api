import Redis from 'ioredis';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('Redis');

let redisClient: Redis | null = null;

export const initializeRedis = (): Redis => {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true;
        }
        return false;
      },
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
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
