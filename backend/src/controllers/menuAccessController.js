const menuAccessService = require('../services/menuAccessService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get all menu access configurations
 * GET /api/admin/menu-access
 */
exports.getMenuAccess = asyncHandler(async (req, res) => {
  const menuAccess = await menuAccessService.getMenuAccess();

  res.json({
    success: true,
    data: menuAccess,
  });
});

/**
 * Update menu access configurations
 * PUT /api/admin/menu-access
 */
exports.updateMenuAccess = asyncHandler(async (req, res) => {
  const { menuAccess } = req.body;

  if (!menuAccess || typeof menuAccess !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Invalid menu access data',
    });
  }

  const updatedBy = req.user.id;
  await menuAccessService.updateMenuAccess(menuAccess, updatedBy);

  res.json({
    success: true,
    message: 'Menu access updated successfully',
  });
});

