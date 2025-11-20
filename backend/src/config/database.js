const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('Query: ' + e.query);
    logger.debug('Duration: ' + e.duration + 'ms');
  });
}

// Log errors
prisma.$on('error', (e) => {
  logger.error('Prisma Error:', e);
});

// Log warnings
prisma.$on('warn', (e) => {
  logger.warn('Prisma Warning:', e);
});

// Note: Graceful shutdown is handled in server.js
// We don't disconnect here to avoid conflicts with test scripts and multiple instances

module.exports = prisma;

