import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { getRedis } from '../../config/redis';

const redis = getRedis();

export const createRateLimiter = (windowMs: number = 15 * 60 * 1000, max: number = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Environment-aware rate limiting: more relaxed limits for development
const isDevelopment = process.env.NODE_ENV !== 'production';

export const authRateLimiter = isDevelopment
  ? createRateLimiter(1 * 60 * 1000, 50) // Dev: 50 requests per 1 minute
  : createRateLimiter(15 * 60 * 1000, 5); // Prod: 5 requests per 15 minutes

export const apiRateLimiter = isDevelopment
  ? createRateLimiter(1 * 60 * 1000, 500) // Dev: 500 requests per 1 minute
  : createRateLimiter(15 * 60 * 1000, 100); // Prod: 100 requests per 15 minutes

export const strictRateLimiter = isDevelopment
  ? createRateLimiter(1 * 60 * 1000, 30) // Dev: 30 requests per 1 minute
  : createRateLimiter(60 * 1000, 10); // Prod: 10 requests per minute

export class RedisRateLimiter {
  private redis: Redis;

  constructor() {
    this.redis = redis;
  }

  async checkLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    return current <= limit;
  }

  async getRemainingAttempts(key: string, limit: number): Promise<number> {
    const current = await this.redis.get(key);
    const used = current ? parseInt(current) : 0;
    return Math.max(0, limit - used);
  }

  async resetLimit(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

export const redisRateLimiter = new RedisRateLimiter();
