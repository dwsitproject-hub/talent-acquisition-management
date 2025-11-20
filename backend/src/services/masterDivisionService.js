const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all divisions
 */
async function getAllDivisions(filters = {}) {
  const where = {};

  if (filters.search) {
    where.OR = [
      { divisionName: { contains: filters.search, mode: 'insensitive' } },
      { sectionName: { contains: filters.search, mode: 'insensitive' } },
      { headOfDivisionName: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.divisionName) {
    where.divisionName = filters.divisionName;
  }

  const divisions = await prisma.masterDivision.findMany({
    where,
    orderBy: [
      { divisionName: 'asc' },
      { sectionName: 'asc' },
    ],
  });

  return divisions;
}

/**
 * Get division by ID
 */
async function getDivisionById(divisionId) {
  const division = await prisma.masterDivision.findUnique({
    where: { id: divisionId },
  });

  if (!division) {
    throw new Error('Division not found');
  }

  return division;
}

/**
 * Create division
 */
async function createDivision(data) {
  // Check if division with same divisionName and sectionName already exists
  const existing = await prisma.masterDivision.findUnique({
    where: {
      divisionName_sectionName: {
        divisionName: data.divisionName,
        sectionName: data.sectionName,
      },
    },
  });

  if (existing) {
    throw new Error('Division with this name and section already exists');
  }

  const division = await prisma.masterDivision.create({
    data,
  });

  logger.info(`Master division created: ${division.id} - ${division.divisionName}/${division.sectionName}`);

  return division;
}

/**
 * Update division
 */
async function updateDivision(divisionId, data) {
  // If updating divisionName or sectionName, check for duplicates
  if (data.divisionName || data.sectionName) {
    const current = await prisma.masterDivision.findUnique({
      where: { id: divisionId },
    });

    if (!current) {
      throw new Error('Division not found');
    }

    const newDivisionName = data.divisionName || current.divisionName;
    const newSectionName = data.sectionName || current.sectionName;

    if (newDivisionName !== current.divisionName || newSectionName !== current.sectionName) {
      const existing = await prisma.masterDivision.findUnique({
        where: {
          divisionName_sectionName: {
            divisionName: newDivisionName,
            sectionName: newSectionName,
          },
        },
      });

      if (existing && existing.id !== divisionId) {
        throw new Error('Division with this name and section already exists');
      }
    }
  }

  const division = await prisma.masterDivision.update({
    where: { id: divisionId },
    data,
  });

  logger.info(`Master division updated: ${divisionId}`);

  return division;
}

/**
 * Delete division
 */
async function deleteDivision(divisionId) {
  const division = await prisma.masterDivision.delete({
    where: { id: divisionId },
  });

  logger.info(`Master division deleted: ${divisionId}`);

  return division;
}

module.exports = {
  getAllDivisions,
  getDivisionById,
  createDivision,
  updateDivision,
  deleteDivision,
};

