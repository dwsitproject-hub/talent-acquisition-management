const crypto = require('crypto');

const prisma = require('../config/database');
const logger = require('../utils/logger');

function generateToken() {
  const randomPart = crypto.randomBytes(6).toString('hex');
  return `cand_${Date.now()}_${randomPart}`;
}

function isExpired(expiresAt) {
  return new Date(expiresAt).getTime() < Date.now();
}

async function createCandidateFormToken(candidateId, options = {}) {
  const expiresInDays = Number(options.expiresInDays) || 7;
  const token = generateToken();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  // Deactivate existing tokens for this candidate
  await prisma.candidateFormToken.updateMany({
    where: {
      candidateId,
      submittedAt: null,
    },
    data: {
      submittedAt: new Date(),
    },
  });

  const record = await prisma.candidateFormToken.create({
    data: {
      candidateId,
      token,
      expiresAt,
    },
  });

  logger.info(`Candidate form token generated for candidate ${candidateId}`);

  return record;
}

async function getCandidateFormToken(token) {
  return prisma.candidateFormToken.findUnique({
    where: { token },
  });
}

async function validateCandidateFormToken(token) {
  const record = await getCandidateFormToken(token);

  if (!record) {
    const error = new Error('Link is invalid.');
    error.statusCode = 404;
    throw error;
  }

  if (record.submittedAt) {
    const error = new Error('Link has already been used.');
    error.statusCode = 410;
    throw error;
  }

  if (isExpired(record.expiresAt)) {
    const error = new Error('Link has expired.');
    error.statusCode = 410;
    throw error;
  }

  return record;
}

async function markCandidateFormTokenSubmitted(token) {
  return prisma.candidateFormToken.update({
    where: { token },
    data: {
      submittedAt: new Date(),
    },
  });
}

module.exports = {
  createCandidateFormToken,
  getCandidateFormToken,
  validateCandidateFormToken,
  markCandidateFormTokenSubmitted,
};

