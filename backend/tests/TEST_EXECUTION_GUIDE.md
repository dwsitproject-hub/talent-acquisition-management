# Test Execution Guide

## Prerequisites

1. **Test Database Setup**
   ```bash
   # Create test database
   createdb tas_db_test
   
   # Run migrations
   cd backend
   DATABASE_URL=postgresql://tas_user:password@localhost:5432/tas_db_test npm run prisma:migrate
   ```

2. **Environment Variables**
   ```bash
   # Set test environment variables
   export NODE_ENV=test
   export DATABASE_URL=postgresql://tas_user:password@localhost:5432/tas_db_test
   export JWT_SECRET=test-jwt-secret-key-for-testing-only-min-32-chars
   export JWT_REFRESH_SECRET=test-refresh-secret-key-for-testing-only-min-32-chars
   export ENCRYPTION_KEY=12345678901234567890123456789012
   ```

3. **Redis (Optional for some tests)**
   ```bash
   # Start Redis for rate limiting tests
   redis-server
   ```

## Running Tests

### Run All Tests
```bash
cd backend
npm test
```

### Run Functional Tests Only
```bash
npm test -- tests/functional
```

### Run Security Tests Only
```bash
npm test -- tests/security
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Run Specific Test File
```bash
npm test -- tests/functional/api.test.js
```

## Test Structure

### Functional Tests (`tests/functional/api.test.js`)
- Health check endpoints
- Authentication flows (register, login, logout)
- Candidate management
- FPTK (job posting) management
- Application management
- Document management
- Dashboard & statistics
- Master data endpoints
- Error handling

### Security Tests (`tests/security/security.test.js`)
- Authentication security (SQL injection, brute force, weak passwords)
- Authorization security (privilege escalation)
- Input validation (XSS, NoSQL injection)
- Data protection (encryption)
- CORS & headers security
- Rate limiting
- Session management
- API endpoint security

## Expected Test Results

### Functional Tests
- **Total Tests**: ~30-40 tests
- **Expected Pass Rate**: 90%+ (some may need database setup)
- **Coverage**: All major API endpoints

### Security Tests
- **Total Tests**: ~25-30 tests
- **Expected Pass Rate**: 85%+ (some may need specific configurations)
- **Coverage**: Critical security vulnerabilities

## Troubleshooting

### Database Connection Issues
```bash
# Check database is running
psql -U tas_user -d tas_db_test -c "SELECT 1"

# Reset test database
dropdb tas_db_test
createdb tas_db_test
npm run prisma:migrate
```

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping

# If not running, start it
redis-server
```

### Test Timeout Issues
- Increase timeout in `jest.config.js`
- Check database performance
- Verify network connectivity

## Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
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
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
```

## Test Reports

Test results are saved to:
- `backend/coverage/` - Code coverage reports
- `backend/tests/TEST_RESULTS.json` - JSON test results
- Console output - Real-time test execution

## Notes

- Some tests require actual database connections
- Rate limiting tests may take longer to execute
- Security tests may generate false positives in development
- Always run tests in a clean test environment

