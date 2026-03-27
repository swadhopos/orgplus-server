const mongoose = require('mongoose');
const Organization = require('./src/models/Organization');
const OrgConfig = require('./src/models/OrgConfig');
const organizationController = require('./src/controllers/organizationController');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus';

const test = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const orgId = '69b7ca290120a39d767fa17c';
    
    // Mock req and res
    const req = {
      params: { id: orgId },
      user: { role: 'systemAdmin' }
    };
    
    const res = {
      json: (data) => {
        console.log('API Response Structure:');
        console.log(JSON.stringify(data, null, 2));
        if (data.data && data.data.config) {
          console.log('\u2705 SUCCESS: Config found in response');
          console.log('Features:', JSON.stringify(data.data.config.features));
        } else {
          console.log('\u274C FAILURE: Config missing in response');
        }
      }
    };
    
    const next = (err) => console.error('Next error:', err);

    await organizationController.getOrganization(req, res, next);
    
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
};

test();
