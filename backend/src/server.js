const path = require('path');
const fs = require('fs');

// Load .env file - try multiple locations
// __dirname is the directory where server.js is located (src/)
// So we need to go up one level to find .env
const envPath = path.resolve(__dirname, '..', '.env');
console.log('Loading .env from:', envPath);
console.log('.env file exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const result = require('dotenv').config({ path: envPath });
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('.env file loaded successfully');
    console.log('DATABASE_URL loaded:', !!process.env.DATABASE_URL);
  }
} else {
  // Fallback to default dotenv behavior
  console.warn('.env file not found at expected path, trying default location...');
  require('dotenv').config();
}

let app, logger, prisma, redis;
try {
  app = require('./app');
  logger = require('./utils/logger');
  prisma = require('./config/database');
  redis = require('./config/redis');
} catch (error) {
  console.error('Error loading modules:', error);
  console.error('Error stack:', error.stack);
  process.exit(1);
}

const PORT = process.env.PORT || 4000;

// Test database connection
async function testConnections() {
  const results = {
    database: false,
    redis: false,
  };

  // Test database connection (required)
  try {
    await prisma.$connect();
    logger.info('PostgreSQL connected successfully');
    results.database = true;
  } catch (error) {
    logger.error('Database connection error:', error.message);
    logger.error('Please check your DATABASE_URL in .env file');
    logger.error('Expected format: postgresql://user:password@host:port/database?schema=public');
    results.database = false;
  }

  // Test Redis connection (optional)
  try {
    await redis.ping();
    logger.info('Redis connected successfully');
    results.redis = true;
  } catch (error) {
    logger.warn('Redis connection failed:', error.message);
    logger.warn('Continuing without Redis. Some features (caching, rate limiting) may be limited.');
    logger.warn('To fix Redis:');
    logger.warn('  1. Make sure Redis is running: redis-server');
    logger.warn('  2. If Redis requires password, update REDIS_URL in .env: redis://:password@localhost:6379');
    logger.warn('  3. Or set REDIS_PASSWORD in .env file');
    results.redis = false;
  }

  // Database is required, Redis is optional
  return results.database;
}

// Start server
async function startServer() {
  const connectionsOk = await testConnections();
  
  if (!connectionsOk) {
    logger.error('Failed to connect to required services');
    process.exit(1);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    logger.info(`API available at: http://0.0.0.0:${PORT}/api`);
    logger.info(`Server listening on all network interfaces (0.0.0.0:${PORT})`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        await prisma.$disconnect();
        logger.info('Database disconnected');
        
        await redis.quit();
        logger.info('Redis disconnected');
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  console.error('Error stack:', error.stack);
  logger.error('Failed to start server:', error);
  process.exit(1);
});

