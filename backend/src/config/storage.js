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
 * 1. STORAGE_LOCAL_PATH if set (laptop / explicit override)
 * 2. Else Synology:
 *    - staging: {STORAGE_SYNOLOGY_ROOT}/{STORAGE_DEPLOYMENT}/{STORAGE_PROJECT_SLUG}
 *      e.g. /mnt/synology/dev/TAS
 *    - production: {STORAGE_SYNOLOGY_ROOT}/{STORAGE_PROJECT_SLUG} (no deployment folder)
 *      e.g. /mnt/synology/TAS
 * 3. Else legacy UPLOAD_DIR
 * 4. Else backend/uploads
 *
 * Do not set STORAGE_LOCAL_PATH on the app server when using the Synology layout —
 * it overrides the composed NAS path.
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

function ensureStorageRoot() {
  const root = getStorageRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

module.exports = {
  resolveStorageLocalPath,
  getStorageRoot,
  getStoragePath,
  ensureStorageRoot,
};
