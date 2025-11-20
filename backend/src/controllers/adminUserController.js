const adminUserService = require('../services/adminUserService');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listUsers = asyncHandler(async (req, res) => {
  const search = (req.query.search || '').toString();
  const role = req.query.role || null;
  const users = await adminUserService.listUsers(search, role);
  res.json({ success: true, data: users });
});

exports.createUser = asyncHandler(async (req, res) => {
  const data = req.body;
  const result = await adminUserService.createUser(data);
  res.status(201).json({ success: true, data: result });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const data = req.body;
  const result = await adminUserService.updateUser(id, data);
  res.json({ success: true, data: result });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { isActive } = req.body;
  const result = await adminUserService.updateStatus(id, !!isActive);
  res.json({ success: true, data: result });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { newPassword } = req.body;
  await adminUserService.resetPassword(id, newPassword);
  res.json({ success: true, message: 'Password reset' });
});


