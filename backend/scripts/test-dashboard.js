/**
 * Test Dashboard Endpoint
 * 
 * This script tests the dashboard stats endpoint to verify chart data is being returned
 * 
 * Usage: node backend/scripts/test-dashboard.js [api_url]
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || process.argv[2] || 'http://localhost:4000';
const TEST_USER = {
  email: process.env.TEST_EMAIL || 'admin@kpn.com',
  password: process.env.TEST_PASSWORD || 'NewStrongPass123!'
};

async function testDashboard() {
  try {
    console.log('='.repeat(60));
    console.log('DASHBOARD ENDPOINT TEST');
    console.log('='.repeat(60));
    console.log(`API URL: ${API_BASE_URL}`);
    console.log(`Test User: ${TEST_USER.email}`);
    console.log('='.repeat(60));

    // Step 1: Login
    console.log('\n[1] Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });

    if (!loginResponse.data?.data?.accessToken && !loginResponse.data?.accessToken) {
      console.error('❌ Login failed: No access token received');
      console.error('Response:', loginResponse.data);
      process.exit(1);
    }

    const token = loginResponse.data?.data?.accessToken || loginResponse.data?.accessToken;
    console.log('✅ Login successful');

    // Step 2: Get Dashboard Stats
    console.log('\n[2] Fetching dashboard stats...');
    const statsResponse = await axios.get(`${API_BASE_URL}/api/dashboard/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!statsResponse.data?.success) {
      console.error('❌ Failed to get dashboard stats');
      console.error('Response:', statsResponse.data);
      process.exit(1);
    }

    const stats = statsResponse.data.data;
    console.log('✅ Dashboard stats retrieved');
    console.log('\n[3] Dashboard Statistics:');
    console.log(`   Total Candidates: ${stats.totalCandidates}`);
    console.log(`   Total FPTKs: ${stats.totalFPTKs}`);
    console.log(`   Open Positions: ${stats.openPositions}`);
    console.log(`   Active Applications: ${stats.activeApplications}`);

    // Step 3: Check Chart Data
    console.log('\n[4] Chart Data:');
    console.log(`   Position Status by Location: ${stats.positionStatusByLocation?.length || 0} locations`);
    console.log(`   Open Position Progress: ${stats.openPositionProgress?.length || 0} areas`);
    console.log(`   SLA by Location: ${stats.slaByLocation?.length || 0} locations`);

    // Step 4: Display Sample Data
    if (stats.positionStatusByLocation && stats.positionStatusByLocation.length > 0) {
      console.log('\n[5] Sample Position Status by Location:');
      stats.positionStatusByLocation.slice(0, 3).forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.location}: Total=${item.total}, Open=${item.open}, Closed=${item.closed}`);
      });
    } else {
      console.log('\n⚠️  WARNING: positionStatusByLocation is empty!');
      console.log('   This could mean:');
      console.log('   - No FPTKs exist in the database');
      console.log('   - FPTKs exist but have no areaDetail or area');
    }

    if (stats.openPositionProgress && stats.openPositionProgress.length > 0) {
      console.log('\n[6] Sample Open Position Progress:');
      stats.openPositionProgress.slice(0, 3).forEach((item, index) => {
        const statusCounts = Object.entries(item.statusCounts || {})
          .map(([status, count]) => `${status}=${count}`)
          .join(', ');
        console.log(`   ${index + 1}. ${item.areaDetail}: Total=${item.total}, Statuses=[${statusCounts}]`);
      });
    } else {
      console.log('\n⚠️  WARNING: openPositionProgress is empty!');
    }

    if (stats.slaByLocation && stats.slaByLocation.length > 0) {
      console.log('\n[7] Sample SLA by Location:');
      stats.slaByLocation.slice(0, 3).forEach((item, index) => {
        const buckets = Object.entries(item.buckets || {})
          .map(([bucket, count]) => `${bucket}=${count}`)
          .join(', ');
        console.log(`   ${index + 1}. ${item.areaDetail}: Total=${item.total}, Buckets=[${buckets}]`);
      });
    } else {
      console.log('\n⚠️  WARNING: slaByLocation is empty!');
      console.log('   This could mean:');
      console.log('   - No FPTKs exist in the database');
      console.log('   - FPTKs exist but have no requestDate');
    }

    // Step 5: Check FPTK Data
    console.log('\n[8] Checking FPTK data in database...');
    const fptkResponse = await axios.get(`${API_BASE_URL}/api/fptk?limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (fptkResponse.data?.data) {
      const fptks = fptkResponse.data.data;
      console.log(`   Found ${fptks.length} FPTKs (showing first 5)`);
      fptks.forEach((fptk, index) => {
        console.log(`   ${index + 1}. ${fptk.positionTitle || fptk.position} - Area: ${fptk.areaDetail || fptk.area || 'N/A'}, Status: ${fptk.currentStatus || fptk.status || 'N/A'}, RequestDate: ${fptk.requestDate || 'N/A'}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST COMPLETE');
    console.log('='.repeat(60));

    // Summary
    const hasChartData = 
      (stats.positionStatusByLocation && stats.positionStatusByLocation.length > 0) ||
      (stats.openPositionProgress && stats.openPositionProgress.length > 0) ||
      (stats.slaByLocation && stats.slaByLocation.length > 0);

    if (hasChartData) {
      console.log('✅ Chart data is being returned correctly');
      process.exit(0);
    } else {
      console.log('❌ Chart data is empty - check the logs above for details');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testDashboard();

