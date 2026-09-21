const fs = require('fs');
const path = require('path');
const { getUploadStaticRoots } = require('../config/storage');
const logger = require('../utils/logger');

function contentDispositionAttachment(fileName) {
  const raw = String(fileName || 'download').replace(/[\u0000-\u001F\u007F]/g, '').trim() || 'download';
  const fallback = raw.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(raw).replace(/['()]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

async function lookupOriginalDownloadName(relativePath) {
  const storedName = path.basename(String(relativePath || '').replace(/\\/g, '/'));
  if (!storedName || process.env.JEST_WORKER_ID) return null;
  try {
    const prisma = require('../config/database');
    const document = await prisma.document.findFirst({
      where: { fileName: storedName },
      select: { originalName: true },
    });
    if (document?.originalName) return document.originalName;

    const fptk = await prisma.fPTK.findFirst({
      where: { fptkFilePath: { endsWith: storedName } },
      select: { fptkFileName: true },
    });
    if (fptk?.fptkFileName) return fptk.fptkFileName;
  } catch (err) {
    logger.warn(`[uploads] original name lookup failed for ${storedName}: ${err.message}`);
  }
  return null;
}

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function resolveUnderRoot(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const full = path.resolve(resolvedRoot, relativePath);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (full !== resolvedRoot && !full.startsWith(prefix)) {
    return null;
  }
  return full;
}

function normalizeUploadRelativePath(urlPath) {
  return String(urlPath || '')
    .split('?')[0]
    .replace(/^\/uploads(?=\/|$)/i, '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');
}

function statUploadFile(full) {
  try {
    const fd = fs.openSync(full, 'r');
    try {
      const st = fs.fstatSync(fd);
      if (st.isDirectory() && !path.extname(full)) {
        return null;
      }
      return { full, size: Number(st.size) || 0 };
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    logger.warn(`[uploads] cannot open ${full}: ${err.code || ''} ${err.message}`);
    return null;
  }
}

function resolveUploadedFile(relativeUrlPath) {
  const rel = normalizeUploadRelativePath(relativeUrlPath);
  if (!rel || rel.includes('\0') || rel.split('/').includes('..')) {
    return null;
  }
  const relFs = rel.split('/').join(path.sep);

  for (const root of getUploadStaticRoots()) {
    const full = resolveUnderRoot(root, relFs);
    if (!full) continue;
    const found = statUploadFile(full);
    if (found) return found;
  }
  return null;
}

async function serveUploadsAsync(req, res, next) {
  const method = req.method;
  if (method !== 'GET' && method !== 'HEAD') {
    return next();
  }

  const requestPath = req.originalUrl || req.url || req.path;
  const found = resolveUploadedFile(requestPath);
  res.setHeader('X-TAS-Uploads', found ? 'hit' : 'miss');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (!found) {
    const rel = normalizeUploadRelativePath(requestPath);
    logger.warn(
      `[uploads] not found ${method} ${req.originalUrl} rel=${rel} roots=${getUploadStaticRoots().join('|')}`
    );
    return res.status(404).json({
      success: false,
      message: 'Upload file not found',
      path: rel,
      roots: getUploadStaticRoots(),
    });
  }

  const rel = normalizeUploadRelativePath(requestPath);
  const downloadName = (await lookupOriginalDownloadName(rel)) || path.basename(found.full);
  const ext = path.extname(found.full).toLowerCase();
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  if (found.size) {
    res.setHeader('Content-Length', found.size);
  }
  res.setHeader('Content-Disposition', contentDispositionAttachment(downloadName));
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (method === 'HEAD') {
    return res.status(200).end();
  }

  const stream = fs.createReadStream(found.full);
  stream.on('error', (err) => {
    logger.error(`[uploads] read failed ${found.full}: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.destroy();
    }
  });
  return stream.pipe(res);
}

function serveUploads(req, res, next) {
  Promise.resolve(serveUploadsAsync(req, res, next)).catch(next);
}

module.exports = {
  serveUploads,
  resolveUploadedFile,
  normalizeUploadRelativePath,
  contentDispositionAttachment,
};
