const mongoose = require('mongoose');
const { createHouseholdSurvey } = require('./src/controllers/householdController');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus';

const runTest = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const req = {
      params: { orgId: '69d64f087bbe3b522cb5bc1e' },
      user: { uid: 'test-admin-uid' },
      body: {
        household: {
          houseName: 'Test Villa',
          houseNumber: '123',
          govHouseNumber: '12/345',
          ward: '5',
          panchayatMunicipality: 'Municipality',
          addressLine1: 'Street 1',
          addressLine2: 'Landmark',
          postalCode: '123456',
          primaryMobile: '9876543210',
          financialStatus: 'APL',
          status: 'active'
        },
        members: [
          {
            fullName: 'Test Father',
            gender: 'male',
            dateOfBirth: '', // Empty string like frontend
            maritalStatus: 'married',
            isHead: true,
            mobileNumber: '9876543210',
            status: 'active',
            medicalInfo: {
              bloodGroup: 'Unknown'
            }
          },
          {
            fullName: 'Test Mother',
            gender: 'female',
            dateOfBirth: '1982-02-02',
            maritalStatus: 'married',
            isHead: false,
            spouseIndex: 0,
            status: 'active',
            medicalInfo: {
              bloodGroup: 'Unknown'
            }
          }
        ],
        email: 'head-' + Date.now() + '@example.com',
        password: 'password123'
      }
    };

    const res = {
      status: (code) => {
        console.log('HTTP Status Code:', code);
        return res;
      },
      json: (data) => {
        console.log('API Response Success:', data);
      }
    };

    const next = (err) => {
      console.error('API Error via next():', err);
    };

    await createHouseholdSurvey(req, res, next);
    
    // Clean up test household
    const Household = require('./src/models/Household');
    const Member = require('./src/models/Member');
    await Household.deleteMany({ houseName: 'Test Villa' });
    await Member.deleteMany({ fullName: { $in: ['Test Father', 'Test Mother'] } });
    console.log('Cleaned up test entries');
    
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
};

runTest();
