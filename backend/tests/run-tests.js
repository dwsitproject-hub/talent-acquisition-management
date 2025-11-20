#!/usr/bin/env node

/**
 * Test Execution Script
 * Runs all tests and generates comprehensive reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('COMPREHENSIVE TEST SUITE EXECUTION');
console.log('='.repeat(80));
console.log('');

const testResults = {
  timestamp: new Date().toISOString(),
  functional: {},
  security: {},
  summary: {},
};

try {
  // Run functional tests
  console.log('📋 Running Functional Tests...');
  console.log('-'.repeat(80));
  try {
    const functionalOutput = execSync(
      'npm test -- tests/functional --coverage --json',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    testResults.functional = JSON.parse(functionalOutput);
    console.log('✅ Functional tests completed');
  } catch (error) {
    console.log('⚠️  Functional tests had issues (check output above)');
    testResults.functional.error = error.message;
  }

  console.log('');
  console.log('🔒 Running Security Tests...');
  console.log('-'.repeat(80));
  try {
    const securityOutput = execSync(
      'npm test -- tests/security --json',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    testResults.security = JSON.parse(securityOutput);
    console.log('✅ Security tests completed');
  } catch (error) {
    console.log('⚠️  Security tests had issues (check output above)');
    testResults.security.error = error.message;
  }

  // Generate summary
  const functionalPassed = testResults.functional.numPassedTests || 0;
  const functionalFailed = testResults.functional.numFailedTests || 0;
  const securityPassed = testResults.security.numPassedTests || 0;
  const securityFailed = testResults.security.numFailedTests || 0;

  testResults.summary = {
    totalTests: (functionalPassed + functionalFailed + securityPassed + securityFailed),
    passed: functionalPassed + securityPassed,
    failed: functionalFailed + securityFailed,
    functional: {
      passed: functionalPassed,
      failed: functionalFailed,
    },
    security: {
      passed: securityPassed,
      failed: securityFailed,
    },
  };

  // Save results
  const resultsPath = path.join(__dirname, 'TEST_RESULTS.json');
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));

  console.log('');
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testResults.summary.totalTests}`);
  console.log(`✅ Passed: ${testResults.summary.passed}`);
  console.log(`❌ Failed: ${testResults.summary.failed}`);
  console.log('');
  console.log('Functional Tests:');
  console.log(`  ✅ Passed: ${testResults.summary.functional.passed}`);
  console.log(`  ❌ Failed: ${testResults.summary.functional.failed}`);
  console.log('');
  console.log('Security Tests:');
  console.log(`  ✅ Passed: ${testResults.summary.security.passed}`);
  console.log(`  ❌ Failed: ${testResults.summary.security.failed}`);
  console.log('');
  console.log(`Results saved to: ${resultsPath}`);
  console.log('='.repeat(80));

} catch (error) {
  console.error('Error running tests:', error);
  process.exit(1);
}

