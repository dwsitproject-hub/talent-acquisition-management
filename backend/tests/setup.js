// Test setup file
// This file runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-min-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only-min-32-chars';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 chars
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://tas_user:tas_secure_password_change_this@localhost:5432/tas_db_test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.CORS_ORIGIN = 'http://localhost:3000,http://localhost:4001';
process.env.CORS_CREDENTIALS = 'true';

// Increase timeout for async operations
jest.setTimeout(30000);

