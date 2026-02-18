/**
 * JavaScript Report API Testing Suite
 * 
 * Usage:
 * node test-report-api.js
 * 
 * Note: Set the token variables below before running
 */

const BASE_URL = 'http://localhost:3000/api/reports';

// Replace with actual JWT tokens
const ADMIN_TOKEN = 'your_admin_jwt_token_here';
const STAFF_TOKEN_DEPT1 = 'your_staff_jwt_token_here_dept1';
const STAFF_TOKEN_DEPT2 = 'your_staff_jwt_token_here_dept2';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

/**
 * Helper function to make API calls
 */
async function apiCall(endpoint, method = 'GET', token = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await response.json();
        return { status: response.status, data };
    } catch (error) {
        return { status: 0, error: error.message };
    }
}

/**
 * Helper function to download PDF
 */
async function downloadPDF(endpoint, token, filename) {
    const options = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    };

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/pdf')) {
            console.log(`${colors.green}✓ PDF received (${response.headers.get('content-length')} bytes)${colors.reset}`);
            return true;
        } else {
            const data = await response.json();
            console.log(`${colors.red}✗ Error: ${data.message}${colors.reset}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}✗ Request failed: ${error.message}${colors.reset}`);
        return false;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('\n=========================================');
    console.log('Document Request Report API Test Suite');
    console.log('=========================================\n');

    // Test 1: Get departments (Admin)
    console.log(`${colors.yellow}Test 1: Get Departments (Admin)${colors.reset}`);
    let result = await apiCall('/departments', 'GET', ADMIN_TOKEN);
    console.log(`Status: ${result.status}`);
    if (result.data) console.log(JSON.stringify(result.data, null, 2));
    console.log('');

    // Test 2: Get departments (Staff)
    console.log(`${colors.yellow}Test 2: Get Departments (Staff)${colors.reset}`);
    result = await apiCall('/departments', 'GET', STAFF_TOKEN_DEPT1);
    console.log(`Status: ${result.status}`);
    if (result.data) console.log(JSON.stringify(result.data, null, 2));
    console.log('');

    // Test 3: Admin - All departments
    console.log(`${colors.yellow}Test 3: Generate PDF - Admin (All Departments)${colors.reset}`);
    const success1 = await downloadPDF(
        '/document-requests?fromDate=2026-01-01&toDate=2026-02-16',
        ADMIN_TOKEN,
        'admin_all.pdf'
    );
    console.log('');

    // Test 4: Admin - Specific department
    console.log(`${colors.yellow}Test 4: Generate PDF - Admin (Department 1)${colors.reset}`);
    const success2 = await downloadPDF(
        '/document-requests?fromDate=2026-01-01&toDate=2026-02-16&departmentId=1',
        ADMIN_TOKEN,
        'admin_dept1.pdf'
    );
    console.log('');

    // Test 5: Staff - Assigned department
    console.log(`${colors.yellow}Test 5: Generate PDF - Staff (Assigned Department)${colors.reset}`);
    const success3 = await downloadPDF(
        '/document-requests?fromDate=2026-01-01&toDate=2026-02-16&departmentId=1',
        STAFF_TOKEN_DEPT1,
        'staff_assigned.pdf'
    );
    console.log('');

    // Test 6: Staff - Unauthorized department (SECURITY TEST)
    console.log(`${colors.yellow}Test 6: Security Test - Unauthorized Department${colors.reset}`);
    result = await apiCall(
        '/document-requests?fromDate=2026-01-01&toDate=2026-02-16&departmentId=2',
        'POST',
        STAFF_TOKEN_DEPT1
    );
    console.log(`Status: ${result.status}`);
    if (result.data) console.log(JSON.stringify(result.data, null, 2));
    if (result.status === 403) {
        console.log(`${colors.green}✓ Security check passed - staff blocked from unauthorized department${colors.reset}`);
    }
    console.log('');

    // Test 7: Invalid date format
    console.log(`${colors.yellow}Test 7: Validation - Invalid Date Format${colors.reset}`);
    result = await apiCall(
        '/document-requests?fromDate=01/01/2026&toDate=2026-02-16',
        'POST',
        ADMIN_TOKEN
    );
    console.log(`Status: ${result.status}`);
    if (result.data) console.log(JSON.stringify(result.data, null, 2));
    console.log('');

    // Test 8: Invalid date range
    console.log(`${colors.yellow}Test 8: Validation - Invalid Date Range${colors.reset}`);
    result = await apiCall(
        '/document-requests?fromDate=2026-02-16&toDate=2026-01-01',
        'POST',
        ADMIN_TOKEN
    );
    console.log(`Status: ${result.status}`);
    if (result.data) console.log(JSON.stringify(result.data, null, 2));
    console.log('');

    // Test 9: Missing parameter
    console.log(`${colors.yellow}Test 9: Validation - Missing Parameter${colors.reset}`);
    result = await apiCall(
        '/document-requests?fromDate=2026-01-01',
        'POST',
        ADMIN_TOKEN
    );
    console.log(`Status: ${result.status}`);
    if (result.data) console.log(JSON.stringify(result.data, null, 2));
    console.log('');

    // Test 10: No token
    console.log(`${colors.yellow}Test 10: Authentication - No Token${colors.reset}`);
    result = await apiCall(
        '/document-requests?fromDate=2026-01-01&toDate=2026-02-16',
        'POST'
    );
    console.log(`Status: ${result.status}`);
    if (result.data) console.log(JSON.stringify(result.data, null, 2));
    console.log('');

    // Test 11: Staff without department
    console.log(`${colors.yellow}Test 11: Validation - Staff Missing Department${colors.reset}`);
    result = await apiCall(
        '/document-requests?fromDate=2026-01-01&toDate=2026-02-16',
        'POST',
        STAFF_TOKEN_DEPT1
    );
    console.log(`Status: ${result.status}`);
    if (result.data) console.log(JSON.stringify(result.data, null, 2));
    console.log('');

    console.log('=========================================');
    console.log('Test Suite Complete');
    console.log('=========================================\n');
}

// Run tests
runTests().catch(console.error);
