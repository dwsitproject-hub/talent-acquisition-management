/**
 * Automated API Test Script
 * 
 * This script tests all API endpoints for the Talent Acquisition System
 * 
 * Usage: node backend/scripts/test-api.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const TEST_USER = {
  email: 'admin@kpn.com',
  password: 'NewStrongPass123!'  // Update this to match your admin password
};

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

let authToken = null;

/**
 * Helper function to make API requests
 */
async function apiRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    if (authToken) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

/**
 * Test function wrapper
 */
async function runTest(name, testFn) {
  testResults.total++;
  console.log(`\n[TEST] ${name}...`);
  
  try {
    const result = await testFn();
    if (result.success) {
      testResults.passed++;
      testResults.tests.push({ name, status: 'PASSED', message: result.message || 'Test passed' });
      console.log(`[PASS] ${name}`);
      return true;
    } else {
      testResults.failed++;
      testResults.tests.push({ name, status: 'FAILED', message: result.message || result.error || 'Test failed' });
      console.log(`[FAIL] ${name}: ${result.message || result.error}`);
      return false;
    }
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAILED', message: error.message });
    console.log(`[FAIL] ${name}: ${error.message}`);
    return false;
  }
}

/**
 * Authentication Tests
 */
async function testAuthentication() {
  await runTest('Login with valid credentials', async () => {
    const result = await apiRequest('POST', '/api/auth/login', {
      email: TEST_USER.email,
      password: TEST_USER.password
    });

    if (result.success && result.data?.data?.accessToken) {
      authToken = result.data.data.accessToken;
      return { success: true, message: 'Login successful' };
    }
    if (result.success && result.data?.accessToken) {
      authToken = result.data.accessToken;
      return { success: true, message: 'Login successful' };
    }
    return { success: false, message: `Login failed: ${JSON.stringify(result.error || result.data)}` };
  });

  await runTest('Login with invalid credentials', async () => {
    const result = await apiRequest('POST', '/api/auth/login', {
      email: TEST_USER.email,
      password: 'wrongpassword'
    });

    if (!result.success && result.status === 401) {
      return { success: true, message: 'Correctly rejected invalid credentials' };
    }
    return { success: false, message: `Should have rejected invalid credentials. Got status ${result.status}, error: ${JSON.stringify(result.error)}` };
  });

  await runTest('Get current user (authenticated)', async () => {
    if (!authToken) {
      return { success: false, message: 'No auth token available' };
    }

    const result = await apiRequest('GET', '/api/auth/me');
    // apiRequest returns {success: true, data: response.data, status: ...}
    // response.data from API is {success: true, data: {...}}
    // So result.data is {success: true, data: {...}}
    // And result.data.data is the user object
    if (result.success && result.data && result.data.success && result.data.data) {
      return { success: true, message: 'User data retrieved' };
    }
    return { success: false, message: `Failed to get user data. Result: ${JSON.stringify({success: result.success, hasData: !!result.data, dataKeys: result.data ? Object.keys(result.data) : []})}` };
  });
}

/**
 * Dashboard Tests
 */
async function testDashboard() {
  await runTest('Get dashboard stats', async () => {
    const result = await apiRequest('GET', '/api/dashboard/stats');
    if (result.success && result.data.data) {
      const stats = result.data.data;
      console.log(`  - Total Candidates: ${stats.totalCandidates}`);
      console.log(`  - Total FPTKs: ${stats.totalFPTKs}`);
      console.log(`  - Position Status by Location: ${stats.positionStatusByLocation?.length || 0} locations`);
      console.log(`  - Open Position Progress: ${stats.openPositionProgress?.length || 0} areas`);
      console.log(`  - SLA by Location: ${stats.slaByLocation?.length || 0} locations`);
      
      // Check if chart data is present
      if (stats.positionStatusByLocation && stats.positionStatusByLocation.length > 0) {
        console.log(`  - Sample Position Status:`, JSON.stringify(stats.positionStatusByLocation[0]));
      } else {
        console.log(`  - WARNING: positionStatusByLocation is empty`);
      }
      
      if (stats.openPositionProgress && stats.openPositionProgress.length > 0) {
        console.log(`  - Sample Open Position Progress:`, JSON.stringify(stats.openPositionProgress[0]));
      } else {
        console.log(`  - WARNING: openPositionProgress is empty`);
      }
      
      if (stats.slaByLocation && stats.slaByLocation.length > 0) {
        console.log(`  - Sample SLA by Location:`, JSON.stringify(stats.slaByLocation[0]));
      } else {
        console.log(`  - WARNING: slaByLocation is empty`);
      }
      
      return { success: true, message: 'Dashboard stats retrieved' };
    }
    return { success: false, message: 'Failed to get dashboard stats' };
  });
}

/**
 * Master Division Tests
 */
async function testMasterDivision() {
  let divisionId = null;

  await runTest('Get all master divisions', async () => {
    const result = await apiRequest('GET', '/api/masters/divisions');
    if (result.success) {
      return { success: true, message: 'Divisions list retrieved' };
    }
    return { success: false, message: 'Failed to get divisions' };
  });

  await runTest('Create new master division', async () => {
    const result = await apiRequest('POST', '/api/masters/divisions', {
      divisionName: 'Test Division',
      sectionName: 'Test Section',
      headOfDivisionName: 'Test Head',
      hiringManagerName: 'Test HM',
    });

    if (result.success && result.data.data?.id) {
      divisionId = result.data.data.id;
      return { success: true, message: 'Division created successfully' };
    }
    return { success: false, message: 'Failed to create division' };
  });

  if (divisionId) {
    await runTest('Get master division by ID', async () => {
      const result = await apiRequest('GET', `/api/masters/divisions/${divisionId}`);
      if (result.success && result.data.data) {
        return { success: true, message: 'Division retrieved by ID' };
      }
      return { success: false, message: 'Failed to get division by ID' };
    });

    await runTest('Update master division', async () => {
      const result = await apiRequest('PUT', `/api/masters/divisions/${divisionId}`, {
        divisionName: 'Updated Test Division',
        sectionName: 'Updated Test Section',
        headOfDivisionName: 'Updated Test Head',
        hiringManagerName: 'Updated Test HM',
      });

      if (result.success) {
        return { success: true, message: 'Division updated successfully' };
      }
      return { success: false, message: 'Failed to update division' };
    });

    await runTest('Delete master division', async () => {
      const result = await apiRequest('DELETE', `/api/masters/divisions/${divisionId}`);
      if (result.success || result.status === 204) {
        return { success: true, message: 'Division deleted successfully' };
      }
      return { success: false, message: 'Failed to delete division' };
    });
  }

  await runTest('Create duplicate master division (should fail)', async () => {
    // Create first division
    await apiRequest('POST', '/api/masters/divisions', {
      divisionName: 'Duplicate Test',
      sectionName: 'Duplicate Section',
      headOfDivisionName: 'Test Head',
      hiringManagerName: 'Test HM',
    });

    // Try to create duplicate
    const result = await apiRequest('POST', '/api/masters/divisions', {
      divisionName: 'Duplicate Test',
      sectionName: 'Duplicate Section',
      headOfDivisionName: 'Test Head',
      hiringManagerName: 'Test HM',
    });

    if (!result.success && (result.status === 400 || result.status === 409)) {
      return { success: true, message: 'Correctly rejected duplicate division' };
    }
    return { success: false, message: 'Should have rejected duplicate division' };
  });
}

/**
 * Master Office Location Tests
 */
async function testMasterOfficeLocation() {
  let locationId = null;

  await runTest('Get all master office locations', async () => {
    const result = await apiRequest('GET', '/api/masters/office-locations');
    if (result.success) {
      return { success: true, message: 'Office locations list retrieved' };
    }
    return { success: false, message: 'Failed to get office locations' };
  });

  await runTest('Create new master office location', async () => {
    const result = await apiRequest('POST', '/api/masters/office-locations', {
      pt: 'PT Test',
      area: 'Test Area',
      areaDetail: 'Test Area Detail'
    });

    if (result.success && result.data.data?.id) {
      locationId = result.data.data.id;
      return { success: true, message: 'Office location created successfully' };
    }
    return { success: false, message: 'Failed to create office location' };
  });

  if (locationId) {
    await runTest('Get master office location by ID', async () => {
      const result = await apiRequest('GET', `/api/masters/office-locations/${locationId}`);
      if (result.success && result.data.data) {
        return { success: true, message: 'Office location retrieved by ID' };
      }
      return { success: false, message: 'Failed to get office location by ID' };
    });

    await runTest('Update master office location', async () => {
      const result = await apiRequest('PUT', `/api/masters/office-locations/${locationId}`, {
        pt: 'PT Updated',
        area: 'Updated Area',
        areaDetail: 'Updated Area Detail'
      });

      if (result.success) {
        return { success: true, message: 'Office location updated successfully' };
      }
      return { success: false, message: 'Failed to update office location' };
    });

    await runTest('Delete master office location', async () => {
      const result = await apiRequest('DELETE', `/api/masters/office-locations/${locationId}`);
      if (result.success || result.status === 204) {
        return { success: true, message: 'Office location deleted successfully' };
      }
      return { success: false, message: 'Failed to delete office location' };
    });
  }
}

/**
 * FPTK Tests
 */
async function testFPTK() {
  let fptkId = null;

  await runTest('Get all FPTKs', async () => {
    const result = await apiRequest('GET', '/api/fptk');
    if (result.success) {
      return { success: true, message: 'FPTKs list retrieved' };
    }
    return { success: false, message: 'Failed to get FPTKs' };
  });

  await runTest('Create new FPTK', async () => {
    const result = await apiRequest('POST', '/api/fptk', {
      pt: 'PT Test',
      division: 'Test Division',
      section: 'Test Section',
      position: 'Test Position',
      positionTitle: 'Test Position Title',
      department: 'Test Department',
      location: 'Test Location',
      employmentType: 'Full-time',
      priority: 'P1',
      status: 'DRAFT',
      numberOfPositions: 1,
      jobDescription: 'Test job description for the position'
    });

    if (result.success && result.data.data?.id) {
      fptkId = result.data.data.id;
      return { success: true, message: 'FPTK created successfully' };
    }
    return { success: false, message: `Failed to create FPTK: ${JSON.stringify(result.error || result.data)}` };
  });

  if (fptkId) {
    await runTest('Get FPTK by ID', async () => {
      const result = await apiRequest('GET', `/api/fptk/${fptkId}`);
      if (result.success && result.data.data) {
        return { success: true, message: 'FPTK retrieved by ID' };
      }
      return { success: false, message: 'Failed to get FPTK by ID' };
    });

    await runTest('Update FPTK', async () => {
      const result = await apiRequest('PUT', `/api/fptk/${fptkId}`, {
        priority: 'P0',
        status: 'OPEN'
      });

      if (result.success) {
        return { success: true, message: 'FPTK updated successfully' };
      }
      return { success: false, message: 'Failed to update FPTK' };
    });

    await runTest('Update FPTK status', async () => {
      const result = await apiRequest('PATCH', `/api/fptk/${fptkId}/status`, {
        status: 'FILLED'
      });

      if (result.success) {
        return { success: true, message: 'FPTK status updated successfully' };
      }
      return { success: false, message: 'Failed to update FPTK status' };
    });
  }
}

/**
 * Candidates Tests
 */
async function testCandidates() {
  await runTest('Get all candidates', async () => {
    const result = await apiRequest('GET', '/api/candidates');
    if (result.success) {
      return { success: true, message: 'Candidates list retrieved' };
    }
    return { success: false, message: 'Failed to get candidates' };
  });
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('TALENT ACQUISITION SYSTEM - API TEST SUITE');
  console.log('='.repeat(60));
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test User: ${TEST_USER.email}`);
  console.log('='.repeat(60));

  try {
    // Authentication
    await testAuthentication();

    if (!authToken) {
      console.log('\n[ERROR] Authentication failed. Cannot proceed with other tests.');
      return;
    }

    // Dashboard
    await testDashboard();

    // Master Data
    await testMasterDivision();
    await testMasterOfficeLocation();

    // FPTK
    await testFPTK();

    // Candidates
    await testCandidates();

  } catch (error) {
    console.error('\n[ERROR] Test execution failed:', error.message);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} (${((testResults.passed / testResults.total) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${testResults.failed} (${((testResults.failed / testResults.total) * 100).toFixed(1)}%)`);
  console.log(`Skipped: ${testResults.skipped} (${((testResults.skipped / testResults.total) * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));

  // Save results to file
  const resultsPath = path.join(__dirname, '../data/test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  console.log(`\nTest results saved to: ${resultsPath}`);

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(console.error);

