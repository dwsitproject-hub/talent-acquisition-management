const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all office locations
 */
async function getAllOfficeLocations(filters = {}) {
  const where = {};

  if (filters.search) {
    where.OR = [
      { pt: { contains: filters.search, mode: 'insensitive' } },
      { area: { contains: filters.search, mode: 'insensitive' } },
      { areaDetail: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.pt) {
    where.pt = filters.pt;
  }

  if (filters.area) {
    where.area = filters.area;
  }

  const officeLocations = await prisma.masterOfficeLocation.findMany({
    where,
    orderBy: [
      { pt: 'asc' },
      { area: 'asc' },
      { areaDetail: 'asc' },
    ],
  });

  return officeLocations;
}

/**
 * Get office location by ID
 */
async function getOfficeLocationById(officeLocationId) {
  const officeLocation = await prisma.masterOfficeLocation.findUnique({
    where: { id: officeLocationId },
  });

  if (!officeLocation) {
    throw new Error('Office location not found');
  }

  return officeLocation;
}

/**
 * Create office location
 */
async function createOfficeLocation(data) {
  // Check if office location with same pt, area, and areaDetail already exists
  const existing = await prisma.masterOfficeLocation.findUnique({
    where: {
      pt_area_areaDetail: {
        pt: data.pt,
        area: data.area,
        areaDetail: data.areaDetail,
      },
    },
  });

  if (existing) {
    throw new Error('Office location with this PT, area, and area detail already exists');
  }

  const officeLocation = await prisma.masterOfficeLocation.create({
    data,
  });

  logger.info(`Master office location created: ${officeLocation.id} - ${officeLocation.pt}/${officeLocation.area}`);

  return officeLocation;
}

/**
 * Update office location
 */
async function updateOfficeLocation(officeLocationId, data) {
  // If updating pt, area, or areaDetail, check for duplicates
  if (data.pt || data.area || data.areaDetail) {
    const current = await prisma.masterOfficeLocation.findUnique({
      where: { id: officeLocationId },
    });

    if (!current) {
      throw new Error('Office location not found');
    }

    const newPt = data.pt || current.pt;
    const newArea = data.area || current.area;
    const newAreaDetail = data.areaDetail || current.areaDetail;

    if (newPt !== current.pt || newArea !== current.area || newAreaDetail !== current.areaDetail) {
      const existing = await prisma.masterOfficeLocation.findUnique({
        where: {
          pt_area_areaDetail: {
            pt: newPt,
            area: newArea,
            areaDetail: newAreaDetail,
          },
        },
      });

      if (existing && existing.id !== officeLocationId) {
        throw new Error('Office location with this PT, area, and area detail already exists');
      }
    }
  }

  const officeLocation = await prisma.masterOfficeLocation.update({
    where: { id: officeLocationId },
    data,
  });

  logger.info(`Master office location updated: ${officeLocationId}`);

  return officeLocation;
}

/**
 * Delete office location
 */
async function deleteOfficeLocation(officeLocationId) {
  const officeLocation = await prisma.masterOfficeLocation.delete({
    where: { id: officeLocationId },
  });

  logger.info(`Master office location deleted: ${officeLocationId}`);

  return officeLocation;
}

module.exports = {
  getAllOfficeLocations,
  getOfficeLocationById,
  createOfficeLocation,
  updateOfficeLocation,
  deleteOfficeLocation,
};

