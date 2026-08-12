const prismaBase = require('./prismaBase');
const logger = require('../utils/logger');
const { createAuditExtension } = require('../utils/prismaAuditExtension');

if (process.env.NODE_ENV === 'development') {
  prismaBase.$on('query', (e) => {
    logger.debug('Query: ' + e.query);
    logger.debug('Duration: ' + e.duration + 'ms');
  });
}

prismaBase.$on('error', (e) => {
  logger.error('Prisma Error:', e);
});

prismaBase.$on('warn', (e) => {
  logger.warn('Prisma Warning:', e);
});

const prisma = prismaBase.$extends(createAuditExtension());

module.exports = prisma;
