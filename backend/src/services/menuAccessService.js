const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all menu access configurations
 */
async function getMenuAccess() {
  try {
    const menuAccessList = await prisma.menuAccess.findMany({
      orderBy: { menuPath: 'asc' },
    });

    // Convert to object format: { '/path': { visibleRoles: [], permissions: { create: [], edit: [] } } }
    const menuAccessMap = {};
    menuAccessList.forEach((menu) => {
      menuAccessMap[menu.menuPath] = {
        visibleRoles: menu.visibleRoles || [],
        permissions: {
          create: menu.createRoles || [],
          edit: menu.editRoles || [],
        },
      };
    });

    return menuAccessMap;
  } catch (error) {
    logger.error('Error fetching menu access:', error);
    throw error;
  }
}

/**
 * Update menu access configurations
 * @param {Object} menuAccessData - Menu access data in format: { '/path': { visibleRoles: [], permissions: { create: [], edit: [] } } }
 * @param {String} updatedBy - User ID who is updating
 */
async function updateMenuAccess(menuAccessData, updatedBy) {
  try {
    const results = [];
    
    // Process each menu path
    for (const [menuPath, config] of Object.entries(menuAccessData)) {
      const { visibleRoles = [], permissions = {} } = config;
      const createRoles = permissions.create || [];
      const editRoles = permissions.edit || [];

      // Find menu label from existing data or use menuPath as fallback
      const existing = await prisma.menuAccess.findUnique({
        where: { menuPath },
      });

      const menuLabel = existing?.menuLabel || menuPath;

      // Upsert menu access configuration
      const result = await prisma.menuAccess.upsert({
        where: { menuPath },
        update: {
          visibleRoles,
          createRoles,
          editRoles,
          updatedBy,
          updatedAt: new Date(),
        },
        create: {
          menuPath,
          menuLabel,
          visibleRoles,
          createRoles,
          editRoles,
          updatedBy,
        },
      });

      results.push(result);
    }

    logger.info(`Menu access updated by user ${updatedBy}`);
    return results;
  } catch (error) {
    logger.error('Error updating menu access:', error);
    throw error;
  }
}

module.exports = {
  getMenuAccess,
  updateMenuAccess,
};

