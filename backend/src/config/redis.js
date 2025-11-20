const Redis = require('ioredis');
const logger = require('../utils/logger');

// Prefer full connection string when provided to avoid brittle parsing
let redis;
let redisConnected = false;

// Parse REDIS_URL to handle password if provided
function createRedisClient() {
  if (process.env.REDIS_URL) {
    // If REDIS_URL is provided, use it directly
    // Format: redis://:password@host:port or redis://host:port
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis connection failed after multiple retries. Continuing without Redis.');
          return null; // Stop retrying
        }
        return Math.min(times * 50, 2000);
      },
      lazyConnect: true, // Don't connect immediately
      enableOfflineQueue: false, // Don't queue commands when offline
    });
  } else {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis connection failed after multiple retries. Continuing without Redis.');
          return null; // Stop retrying
        }
        return Math.min(times * 50, 2000);
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false,
    };
    return new Redis(redisConfig);
  }
}

redis = createRedisClient();

redis.on('connect', () => {
  logger.info('Redis connected successfully');
  redisConnected = true;
});

redis.on('error', (err) => {
  // Suppress common connection errors that are expected when Redis is not available
  const suppressErrors = [
    'ECONNREFUSED',
    'NOAUTH',
    'ENOTFOUND',
    'ETIMEDOUT',
    'Connection is closed'
  ];
  
  const shouldSuppress = suppressErrors.some(errorType => 
    err.message.includes(errorType) || err.code === errorType
  );
  
  if (!shouldSuppress) {
    logger.warn('Redis connection error:', err.message);
  }
  redisConnected = false;
});

redis.on('close', () => {
  if (redisConnected) {
    logger.warn('Redis connection closed');
    redisConnected = false;
  }
});

// Try to connect initially (but don't fail if it doesn't work)
(async () => {
  try {
    await redis.connect();
  } catch (error) {
    // Ignore initial connection errors - we'll handle them on first use
    logger.debug('Redis initial connection skipped (will connect on first use)');
  }
})();

// Wrapper functions to handle Redis being unavailable
const redisWrapper = {
  ping: async () => {
    try {
      // Try to connect if not already connected
      if (!redisConnected) {
        try {
          await redis.connect();
        } catch (connectError) {
          // If connection fails, throw error
          throw new Error('Redis not connected');
        }
      }
      return await redis.ping();
    } catch (error) {
      redisConnected = false;
      throw error;
    }
  },
  get: async (key) => {
    if (!redisConnected) return null;
    try {
      return await redis.get(key);
    } catch (error) {
      redisConnected = false;
      return null;
    }
  },
  set: async (key, value, ...args) => {
    if (!redisConnected) return 'OK';
    try {
      return await redis.set(key, value, ...args);
    } catch (error) {
      redisConnected = false;
      return 'OK';
    }
  },
  del: async (key) => {
    if (!redisConnected) return 0;
    try {
      return await redis.del(key);
    } catch (error) {
      redisConnected = false;
      return 0;
    }
  },
  quit: async () => {
    if (redisConnected) {
      try {
        await redis.quit();
      } catch (error) {
        // Ignore errors on quit
      }
    }
  },
  // Expose the underlying client for advanced usage
  client: redis,
  isConnected: () => redisConnected,
};

// Graceful shutdown
process.on('beforeExit', async () => {
  if (redisConnected) {
    try {
      await redisWrapper.quit();
      logger.info('Redis disconnected');
    } catch (error) {
      // Ignore errors on shutdown
    }
  }
});

module.exports = redisWrapper;

