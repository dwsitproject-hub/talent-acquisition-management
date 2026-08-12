const { PrismaClient } = require('@prisma/client');

const prismaBase = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

module.exports = prismaBase;
