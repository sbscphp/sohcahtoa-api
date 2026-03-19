import { getRedis } from '../../../config/redis';

// Export a lazy proxy so the client is always resolved at call time,
// not at module-load time (which would run before initializeRedis()).
const redis = new Proxy({} as ReturnType<typeof getRedis>, {
  get(_target, prop) {
    return (getRedis() as any)[prop];
  },
});

export default redis;
