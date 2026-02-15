const axios = require('axios');

// Test Registration
async function testRegister() {
    try {
        console.log('Testing registration endpoint...\n');

        const testUser = {
            username: 'testuser' + Date.now(),
            email: `test${Date.now()}@test.com`,
            password: 'password123'
        };

        console.log('Sending POST to http://localhost:5000/api/auth/register');
        console.log('Payload:', testUser);

        const response = await axios.post('http://localhost:5000/api/auth/register', testUser);

        console.log('\n✅ Registration successful!');
        console.log('Response:', response.data);

    } catch (error) {
        console.error('\n❌ Registration failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data);
        } else if (error.request) {
            console.error('No response received from server');
            console.error('Is the backend running on port 5000?');
        } else {
            console.error('Error:', error.message);
        }
    }
}

testRegister();
