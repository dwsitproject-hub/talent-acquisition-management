# Test Suite Documentation

## ⚠️ Important: Database Setup Required

The functional and security tests require a test database to be set up. If you see database connection errors, follow the setup instructions below.

## Quick Setup

### Option 1: Use Docker (Recommended)

```bash
# Start PostgreSQL in Docker
docker run -d \
  --name tas-test-db \
  -e POSTGRES_USER=tas_user \
  -e POSTGRES_PASSWORD=tas_secure_password_change_this \
  -e POSTGRES_DB=tas_db_test \
  -p 5433:5432 \
  postgres:15-alpine

# Wait for database to be ready
sleep 5

# Run migrations
cd backend
DATABASE_URL=postgresql://tas_user:tas_secure_password_change_this@localhost:5433/tas_db_test npm run prisma:migrate

# Run tests
npm test
```

### Option 2: Use Existing Database

```bash
# Set environment variables
export DATABASE_URL=postgresql://tas_user:your_password@localhost:5432/tas_db_test
export NODE_ENV=test
export JWT_SECRET=test-jwt-secret-key-for-testing-only-min-32-chars
export JWT_REFRESH_SECRET=test-refresh-secret-key-for-testing-only-min-32-chars
export ENCRYPTION_KEY=12345678901234567890123456789012

# Create test database (if it doesn't exist)
createdb -U postgres tas_db_test

# Run migrations
cd backend
npm run prisma:migrate

# Run tests
npm test
```

### Option 3: Skip Database Tests (For CI/CD)

If you just want to verify the test structure without running database-dependent tests:

```bash
# Tests will automatically skip if database is not available
npm test
```

The tests are designed to gracefully skip when the database is not available, so you can still verify the test structure.

## Test Structure

### Functional Tests (`tests/functional/api.test.js`)
- Tests all API endpoints
- Requires database connection
- Creates test data and cleans up after

### Security Tests (`tests/security/security.test.js`)
- Tests security vulnerabilities
- Requires database connection
- Tests authentication, authorization, input validation

## Troubleshooting

### Database Connection Errors

**Error**: `Authentication failed against database server`

**Solutions**:
1. Check PostgreSQL is running: `pg_isready` or `docker ps`
2. Verify database exists: `psql -U tas_user -d tas_db_test -c "SELECT 1"`
3. Check credentials in `DATABASE_URL`
4. Ensure user has permissions: `GRANT ALL PRIVILEGES ON DATABASE tas_db_test TO tas_user;`

### Migration Errors

**Error**: `Migration failed`

**Solutions**:
1. Reset test database: `dropdb tas_db_test && createdb tas_db_test`
2. Run migrations: `npm run prisma:migrate`
3. Check Prisma schema is valid: `npx prisma validate`

### Test Timeout Errors

**Error**: `Timeout - Async callback was not invoked`

**Solutions**:
1. Increase timeout in `jest.config.js`
2. Check database performance
3. Verify Redis is running (for rate limiting tests)

## Running Specific Tests

```bash
# Run only functional tests
npm test -- tests/functional

# Run only security tests
npm test -- tests/security

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## CI/CD Integration

For CI/CD pipelines, you can:

1. **Use Docker Compose**:
```yaml
services:
  test-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: tas_user
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: tas_db_test
```

2. **Use GitHub Actions**:
```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_PASSWORD: postgres
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

## Notes

- Tests automatically skip if database is not available
- Test data is cleaned up after each test run
- Tests use a separate test database to avoid affecting development data
- All sensitive operations are tested with proper error handling

