const mongoose = require('mongoose');
const { createMember } = require('./src/controllers/memberController');
require('dotenv').config();

// Mock Express response object
const mockRes = {
  statusCode: 200,
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    console.log('--- API RESPONSE ---');
    console.log('Status:', this.statusCode);
    console.log('Body:', JSON.stringify(data, null, 2));
    console.log('--- END RESPONSE ---');
  }
};

const mockNext = (err) => {
  console.error('--- API ERROR (via next) ---');
  console.error(err);
  console.error('--- END ERROR ---');
};

async function runTest() {
  try {
    console.log('Initializing Verification Test...');
    
    // Connect to database using env URI
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    // Prepare request payload matching the user's test case
    const req = {
      params: { orgId: '69beb414621851a688a22210' }, // An 'individual_only' organization
      body: {
        fullName: 'Citu Test Member',
        gender: 'male',
        maritalStatus: 'single',
        email: 'citu@google.com',
        createLogin: true,
        password: '12345678'
      },
      user: { uid: 'internal-tester' } // Simulated logged-in user
    };

    console.log(`Executing createMember for: ${req.body.email}`);
    await createMember(req, mockRes, mockNext);
    
  } catch (error) {
    console.error('Fatal Script Error:', error);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('Disconnected from MongoDB.');
    }
  }
}

runTest().catch(console.error);
