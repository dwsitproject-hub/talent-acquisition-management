const path = require('path');
const { resolveStorageLocalPath, getStoragePath, getUploadStaticRoots } = require('../../src/config/storage');

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const KEYS = [
  'STORAGE_LOCAL_PATH',
  'STORAGE_SYNOLOGY_ROOT',
  'STORAGE_DEPLOYMENT',
  'STORAGE_PROJECT_SLUG',
  'UPLOAD_DIR',
  'STORAGE_UPLOAD_INCLUDE_NESTED',
];

describe('storage path resolution', () => {
  const original = {};

  beforeEach(() => {
    KEYS.forEach((key) => {
      original[key] = process.env[key];
      delete process.env[key];
    });
  });

  afterEach(() => {
    KEYS.forEach((key) => {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    });
  });

  test('defaults to backend/uploads when no storage env is set', () => {
    expect(resolveStorageLocalPath()).toBe(path.join(BACKEND_ROOT, 'uploads'));
  });

  test('uses STORAGE_LOCAL_PATH relative to the backend root', () => {
    process.env.STORAGE_LOCAL_PATH = './uploads';
    expect(resolveStorageLocalPath()).toBe(path.join(BACKEND_ROOT, 'uploads'));
  });

  test('STORAGE_LOCAL_PATH wins over the Synology composition', () => {
    process.env.STORAGE_LOCAL_PATH = './uploads';
    process.env.STORAGE_SYNOLOGY_ROOT = '/mnt/synology';
    process.env.STORAGE_DEPLOYMENT = 'dev';
    process.env.STORAGE_PROJECT_SLUG = 'TAS';
    expect(resolveStorageLocalPath()).toBe(path.join(BACKEND_ROOT, 'uploads'));
  });

  test('staging composes /mnt/synology/dev/TAS', () => {
    process.env.STORAGE_SYNOLOGY_ROOT = '/mnt/synology';
    process.env.STORAGE_DEPLOYMENT = 'dev';
    process.env.STORAGE_PROJECT_SLUG = 'TAS';
    expect(resolveStorageLocalPath()).toBe(path.join('/mnt/synology', 'dev', 'TAS'));
  });

  test('production composes /mnt/synology/TAS when STORAGE_DEPLOYMENT is omitted', () => {
    process.env.STORAGE_SYNOLOGY_ROOT = '/mnt/synology';
    process.env.STORAGE_PROJECT_SLUG = 'TAS';
    expect(resolveStorageLocalPath()).toBe(path.join('/mnt/synology', 'TAS'));
  });

  test('ignores incomplete Synology env and falls back to uploads', () => {
    process.env.STORAGE_SYNOLOGY_ROOT = '/mnt/synology';
    process.env.STORAGE_DEPLOYMENT = 'dev';
    expect(resolveStorageLocalPath()).toBe(path.join(BACKEND_ROOT, 'uploads'));
  });

  test('uses legacy UPLOAD_DIR when Option B is not set', () => {
    process.env.UPLOAD_DIR = './legacy-uploads';
    expect(resolveStorageLocalPath()).toBe(path.join(BACKEND_ROOT, 'legacy-uploads'));
  });

  test('joins document subpaths under the production root', () => {
    process.env.STORAGE_SYNOLOGY_ROOT = '/mnt/synology';
    process.env.STORAGE_PROJECT_SLUG = 'TAS';
    expect(getStoragePath('candidates', 'abc')).toBe(
      path.join('/mnt/synology', 'TAS', 'candidates', 'abc')
    );
    expect(getStoragePath('fptk')).toBe(path.join('/mnt/synology', 'TAS', 'fptk'));
  });

  test('download roots are only the TAS folder', () => {
    process.env.STORAGE_SYNOLOGY_ROOT = '/mnt/synology';
    process.env.STORAGE_DEPLOYMENT = 'dev';
    process.env.STORAGE_PROJECT_SLUG = 'TAS';
    expect(getUploadStaticRoots()).toEqual([
      path.join('/mnt/synology', 'dev', 'TAS'),
    ]);
  });

  test('nested leftover root is included only when explicitly enabled', () => {
    process.env.STORAGE_LOCAL_PATH = '/mnt/synology-tas';
    process.env.STORAGE_UPLOAD_INCLUDE_NESTED = 'true';
    expect(getUploadStaticRoots()).toEqual([
      '/mnt/synology-tas',
      path.join('/mnt/synology-tas', 'dev', 'TAS'),
    ]);
  });
});
