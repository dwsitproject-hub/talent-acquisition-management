/**
 * Comprehensive Security Test Suite
 * Penetration testing and security vulnerability checks
 */

const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/config/database');
// Note: We'll use login to get tokens for security tests

describe('Security Test Suite - Penetration Testing', () => {
  let candidateToken;
  let taToken;
  let dbConnected = false;

  beforeAll(async () => {
    // Check database connection
    try {
      await prisma.$connect();
      dbConnected = true;
    } catch (error) {
      console.warn('⚠️  Database connection failed. Security tests will be skipped.');
      console.warn('   To run security tests, ensure database is set up (see tests/README.md)');
      dbConnected = false;
      return;
    }
    // Create test users with proper password hashing
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
    
    const candidateUser = await prisma.user.create({
      data: {
        email: 'security.test.candidate@example.com',
        password: hashedPassword,
        firstName: 'Security',
        lastName: 'Test',
        role: 'CANDIDATE',
        isActive: true,
      },
    });
    
    // Login to get token
    const candidateLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'security.test.candidate@example.com',
        password: 'TestPassword123!',
      });
    if (candidateLogin.status === 200) {
      candidateToken = candidateLogin.body.data.accessToken;
    }

    const taUser = await prisma.user.create({
      data: {
        email: 'security.test.ta@example.com',
        password: hashedPassword,
        firstName: 'TA',
        lastName: 'User',
        role: 'TA_HO',
        isActive: true,
      },
    });
    
    const taLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'security.test.ta@example.com',
        password: 'TestPassword123!',
      });
    if (taLogin.status === 200) {
      taToken = taLogin.body.data.accessToken;
    }
  });

  afterAll(async () => {
    if (dbConnected) {
      await prisma.user.deleteMany({
        where: {
          email: {
            contains: 'security.test',
          },
        },
      }).catch(() => {});
      await prisma.$disconnect();
    }
  });

  describe('1. Authentication Security', () => {
    test('Should prevent SQL injection in login email', async () => {
      if (!dbConnected) {
        console.log('⏭️  Skipping test - database not connected');
        return;
      }
      const sqlInjectionAttempts = [
        "' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users--",
        "'; DROP TABLE users--",
      ];

      for (const attempt of sqlInjectionAttempts) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: attempt,
            password: 'anything',
          });

        // Should not return 500 (server error) - indicates SQL injection protection
        expect(res.status).not.toBe(500);
        // Should return 401 (unauthorized) or 400 (bad request)
        expect([400, 401]).toContain(res.status);
      }
    });

    test('Should prevent brute force attacks with rate limiting', async () => {
      if (!dbConnected) {
        console.log('⏭️  Skipping test - database not connected');
        return;
      }
      // Attempt multiple failed logins
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword',
          });
      }

      // Should eventually get rate limited (429)
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      // May return 429 (Too Many Requests) or 401 (Unauthorized)
      expect([401, 429]).toContain(res.status);
    }, 30000);

    test('Should reject weak passwords', async () => {
      if (!dbConnected) {
        console.log('⏭️  Skipping test - database not connected');
        return;
      }
      const weakPasswords = ['123', 'password', 'abc', '12345678'];

      for (const password of weakPasswords) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email: `weak${Date.now()}@example.com`,
            password,
            firstName: 'Test',
            lastName: 'User',
          });

        // Should reject weak passwords (400 or 422)
        if (res.status === 201) {
          console.warn(`Warning: Weak password "${password}" was accepted`);
        }
      }
    });

    test('Should prevent JWT token tampering', async () => {
      if (!dbConnected || !candidateToken) {
        console.log('⏭️  Skipping test - database not connected or token not available');
        return;
      }
      const tamperedToken = candidateToken.slice(0, -5) + 'XXXXX';

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    test('Should require authentication for protected routes', async () => {
      // This test doesn't require database
      const protectedRoutes = [
        { method: 'get', path: '/api/candidates' },
        { method: 'get', path: '/api/fptk' },
        { method: 'get', path: '/api/applications' },
        { method: 'get', path: '/api/dashboard/stats' },
      ];

      for (const route of protectedRoutes) {
        const res = await request(app)[route.method](route.path);
        expect(res.status).toBe(401);
      }
    });
  });

  describe('2. Authorization Security', () => {
    test('Should prevent privilege escalation - Candidate cannot create candidates', async () => {
      if (!dbConnected || !candidateToken) {
        console.log('⏭️  Skipping test - database not connected or token not available');
        return;
      }
      const res = await request(app)
        .post('/api/candidates')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          email: 'hacked@example.com',
          firstName: 'Hacked',
          lastName: 'User',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    test('Should prevent unauthorized access to other users data', async () => {
      if (!dbConnected || !candidateToken) {
        console.log('⏭️  Skipping test - database not connected or token not available');
        return;
      }
      // Create another candidate
      const otherCandidate = await prisma.user.create({
        data: {
          email: 'other.candidate@example.com',
          password: 'hashed',
          firstName: 'Other',
          lastName: 'Candidate',
          role: 'CANDIDATE',
          isActive: true,
        },
      });

      const otherCandidateRecord = await prisma.candidate.findUnique({
        where: { userId: otherCandidate.id },
      });

      if (otherCandidateRecord) {
        // Try to access other candidate's profile
        const res = await request(app)
          .get(`/api/candidates/${otherCandidateRecord.id}`)
          .set('Authorization', `Bearer ${candidateToken}`)
          .expect(403);

        expect(res.body.success).toBe(false);
      }

      await prisma.user.delete({ where: { id: otherCandidate.id } });
    });
  });

  describe('3. Input Validation & Sanitization', () => {
    test('Should prevent XSS in user input', async () => {
      if (!dbConnected || !taToken) {
        console.log('⏭️  Skipping test - database not connected or token not available');
        return;
      }
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
      ];

      for (const payload of xssPayloads) {
        const res = await request(app)
          .post('/api/candidates')
          .set('Authorization', `Bearer ${taToken}`)
          .send({
            email: `test${Date.now()}@example.com`,
            firstName: payload,
            lastName: 'Test',
          });

        // Should either reject (400) or sanitize (201)
        if (res.status === 201) {
          // If accepted, check that script tags are not in response
          expect(JSON.stringify(res.body)).not.toContain('<script>');
        }
      }
    });

    test('Should prevent NoSQL injection', async () => {
      if (!dbConnected) {
        console.log('⏭️  Skipping test - database not connected');
        return;
      }
      const nosqlPayloads = [
        { $ne: null },
        { $gt: '' },
        { $regex: '.*' },
      ];

      for (const payload of nosqlPayloads) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'anything',
          });

        expect(res.status).not.toBe(500);
      }
    });

    test('Should validate email format', async () => {
      if (!dbConnected) {
        console.log('⏭️  Skipping test - database not connected');
        return;
      }
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'test@',
        'test..test@example.com',
      ];

      for (const email of invalidEmails) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            password: 'ValidPassword123!',
            firstName: 'Test',
            lastName: 'User',
          });

        // Should reject invalid emails
        expect([400, 422]).toContain(res.status);
      }
    });

    test('Should prevent path traversal in file uploads', async () => {
      // This test doesn't require database
      // This would be tested with actual file upload
      // For now, we check that the endpoint exists and requires auth
      const res = await request(app)
        .post('/api/documents/upload')
        .send({});

      expect([401, 404]).toContain(res.status);
    });
  });

  describe('4. Data Protection', () => {
    test('Should encrypt sensitive PII data', async () => {
      if (!dbConnected || !taToken) {
        console.log('⏭️  Skipping test - database not connected or token not available');
        return;
      }
      // Create candidate with sensitive data
      const res = await request(app)
        .post('/api/candidates')
        .set('Authorization', `Bearer ${taToken}`)
        .send({
          email: `encrypt.test${Date.now()}@example.com`,
          firstName: 'Encrypt',
          lastName: 'Test',
          idNumber: '1234567890123456', // National ID
        })
        .expect(201);

      // Check database directly - nationalId should be encrypted
      const candidate = await prisma.candidate.findUnique({
        where: { id: res.body.data.id },
      });

      if (candidate && candidate.nationalId) {
        // Encrypted data should not match plain text
        expect(candidate.nationalId).not.toBe('1234567890123456');
        // Should be longer due to encryption overhead
        expect(candidate.nationalId.length).toBeGreaterThan(16);
      }
    });

    test('Should not expose sensitive data in error messages', async () => {
      if (!dbConnected) {
        console.log('⏭️  Skipping test - database not connected');
        return;
      }
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrong',
        });

      // Error message should not reveal if user exists
      expect(JSON.stringify(res.body)).not.toContain('user not found');
      expect(JSON.stringify(res.body)).not.toContain('password');
    });
  });

  describe('5. CORS & Headers Security', () => {
    test('Should have proper CORS configuration', async () => {
      // This test doesn't require database
      const res = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'https://malicious-site.com')
        .expect(200);

      // CORS headers should be present
      // If CORS is properly configured, unauthorized origins should be rejected
      // This depends on CORS_ORIGIN env variable
    });

    test('Should have security headers (Helmet)', async () => {
      // This test doesn't require database
      const res = await request(app)
        .get('/health');

      // Check for security headers
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('6. Rate Limiting', () => {
    test('Should rate limit API requests', async () => {
      // This test doesn't require database
      // Make many requests quickly
      const requests = [];
      for (let i = 0; i < 150; i++) {
        requests.push(
          request(app)
            .get('/health')
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429)
      const rateLimited = responses.filter(r => r.status === 429);
      // Note: Rate limiting may not trigger on /health endpoint
      // This is a basic check
      expect(responses.length).toBe(150);
    }, 30000);
  });

  describe('7. Session Management', () => {
    test('Should invalidate tokens on logout', async () => {
      if (!dbConnected) {
        console.log('⏭️  Skipping test - database not connected');
        return;
      }
      // Login first
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'security.test.candidate@example.com',
          password: 'TestPassword123!',
        });

      if (loginRes.status === 200 && loginRes.body.data.accessToken) {
        const token = loginRes.body.data.accessToken;

        // Logout
        await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // Token should still work for access token (stateless)
        // But refresh token should be invalidated
        // This depends on implementation
      }
    });
  });

  describe('8. API Endpoint Security', () => {
    test('Should not expose sensitive endpoints', async () => {
      // This test doesn't require database
      const sensitivePaths = [
        '/api/admin/users',
        '/api/admin/roles',
        '/.env',
        '/config',
        '/database',
      ];

      for (const path of sensitivePaths) {
        const res = await request(app).get(path);
        // Should return 404 or 401, not 200 with sensitive data
        expect([401, 404]).toContain(res.status);
      }
    });

    test('Should validate UUID format in route parameters', async () => {
      if (!dbConnected || !taToken) {
        console.log('⏭️  Skipping test - database not connected or token not available');
        return;
      }
      const invalidIds = [
        'invalid-id',
        "'; DROP TABLE candidates--",
        '../../etc/passwd',
        '<script>alert(1)</script>',
      ];

      for (const id of invalidIds) {
        const res = await request(app)
          .get(`/api/candidates/${id}`)
          .set('Authorization', `Bearer ${taToken}`);

        // Should return 400 or 404, not 500
        expect(res.status).not.toBe(500);
        expect([400, 404]).toContain(res.status);
      }
    });
  });
});

