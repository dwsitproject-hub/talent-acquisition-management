const fs = require('fs');
const path = require('path');
const { getUploadStaticRoots } = require('../config/storage');
const logger = require('../utils/logger');

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

function resolveUploadedFile(relativeUrlPath) {
  const rel = String(relativeUrlPath || '')
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');
  if (!rel || rel.includes('\0') || rel.split('/').includes('..')) {
    return null;
  }
  const relFs = rel.split('/').join(path.sep);

  for (const root of getUploadStaticRoots()) {
    const full = resolveUnderRoot(root, relFs);
    if (!full) continue;
    try {
      const st = fs.statSync(full);
      if (st.isFile()) {
        return { full, size: st.size };
      }
    } catch {
      // CIFS/stat miss — try the next root
    }
  }
  return null;
}

function serveUploads(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const found = resolveUploadedFile(req.path);
  if (!found) {
    logger.warn(`[uploads] not found ${req.method} ${req.originalUrl} roots=${getUploadStaticRoots().join('|')}`);
    return next();
  }

  const ext = path.extname(found.full).toLowerCase();
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  res.setHeader('Content-Length', found.size);
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') {
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

module.exports = {
  serveUploads,
  resolveUploadedFile,
};
