import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

export const createRateLimiter = (windowMs: number = 15 * 60 * 1000, max: number = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });
};

export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 5); // 5 requests per 15 minutes
export const apiRateLimiter = createRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
export const strictRateLimiter = createRateLimiter(60 * 1000, 10); // 10 requests per minute

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
