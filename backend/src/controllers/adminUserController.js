const adminUserService = require('../services/adminUserService');
const { asyncHandler } = require('../middleware/errorHandler');
const { parseSpreadsheet, sendTemplate } = require('../utils/spreadsheet');
const bulkImportService = require('../services/bulkImportService');

exports.listUsers = asyncHandler(async (req, res) => {
  const search = (req.query.search || '').toString();
  const role = req.query.role || null;
  const area = req.query.area || null;
  const users = await adminUserService.listUsers(search, role, area);
  res.json({ success: true, data: users });
});

exports.createUser = asyncHandler(async (req, res) => {
  const data = req.body;
  const result = await adminUserService.createUser(data, req.user);
  res.status(201).json({ success: true, data: result });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const data = req.body;
  const result = await adminUserService.updateUser(id, data, req.user);
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

exports.bulkTemplate = asyncHandler(async (req, res) => {
  const format = (req.query.format || 'xlsx').toString();
  return sendTemplate(res, {
    filenameBase: 'user-management-upload-template',
    format,
    headers: [
      'First Name',
      'Last Name',
      'Email',
      'Phone Number',
      'Role',
      'Division',
      'Section Name',
      'PT',
      'Area',
      'Area Detail',
      'Password',
    ],
  });
});

exports.bulkUpload = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please attach a file field named "file".',
    });
  }

  const { rows } = parseSpreadsheet(req.files.file.data);
  const result = await bulkImportService.importAdminUsers(rows);

  return res.status(200).json({
    success: true,
    message: 'User management bulk upload processed',
    data: result,
  });
});


