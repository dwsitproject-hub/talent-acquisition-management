const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_UPLOADS = path.join(BACKEND_ROOT, 'uploads');

function trimEnv(key) {
  return String(process.env[key] || '').trim();
}

function resolveConfiguredPath(value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(BACKEND_ROOT, value);
}

/**
 * Document storage root:
 * 1. STORAGE_LOCAL_PATH if set — used on laptops (./uploads) and on the TAS
 *    app server after CIFS is mounted (e.g. /mnt/synology-tas for APPs/dev/TAS).
 * 2. Else Synology composition:
 *    - with STORAGE_DEPLOYMENT: {root}/{deployment}/{slug}
 *    - without: {root}/{slug}
 * 3. Else legacy UPLOAD_DIR
 * 4. Else backend/uploads
 */
function resolveStorageLocalPath() {
  const explicit = trimEnv('STORAGE_LOCAL_PATH');
  if (explicit) {
    return resolveConfiguredPath(explicit);
  }

  const root = trimEnv('STORAGE_SYNOLOGY_ROOT');
  const deployment = trimEnv('STORAGE_DEPLOYMENT');
  const project = trimEnv('STORAGE_PROJECT_SLUG');
  if (root && project) {
    const composed = deployment ? path.join(root, deployment, project) : path.join(root, project);
    return path.isAbsolute(root) ? composed : path.resolve(BACKEND_ROOT, composed);
  }

  const legacy = trimEnv('UPLOAD_DIR');
  if (legacy) {
    return resolveConfiguredPath(legacy);
  }

  return DEFAULT_UPLOADS;
}

function getStorageRoot() {
  return resolveStorageLocalPath();
}

function getStoragePath(...segments) {
  return path.join(getStorageRoot(), ...segments);
}

/**
 * Directories Express should serve under /uploads.
 * Always the TAS storage root only — never a parent share.
 * Set STORAGE_UPLOAD_INCLUDE_NESTED=true to also serve `{root}/dev/TAS`
 * for files left over from an older mount layout.
 */
function getUploadStaticRoots() {
  const root = getStorageRoot();
  const roots = [root];
  const includeNested = /^(1|true|yes)$/i.test(trimEnv('STORAGE_UPLOAD_INCLUDE_NESTED'));
  if (includeNested) {
    const nested = path.join(root, 'dev', 'TAS');
    if (nested !== root && !roots.includes(nested)) {
      roots.push(nested);
    }
  }
  return roots;
}

function ensureStorageRoot() {
  const root = getStorageRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

module.exports = {
  resolveStorageLocalPath,
  getStorageRoot,
  getStoragePath,
  getUploadStaticRoots,
  ensureStorageRoot,
};
