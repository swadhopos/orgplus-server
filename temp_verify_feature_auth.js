const mongoose = require('mongoose');
const OrgConfig = require('./src/models/OrgConfig');
const { requireFeature } = require('./src/middleware/featureAuth');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus';

const test = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for Verification');

    const orgId = '69b7ca290120a39d767fa17c';
    
    // 1. Test: Feature Enabled
    console.log('\n--- Scenario 1: Feature Enabled (hasEvents: true) ---');
    await mongoose.connection.db.collection('orgconfigs').updateOne(
      { organizationId: new mongoose.Types.ObjectId(orgId) }, 
      { $set: { 'features.hasEvents': true } }
    );
    
    let req = { params: { orgId }, user: { role: 'admin', orgId }, id: 'test-1' };
    let res = {};
    let nextCalledWith = null;
    const next = (err) => { nextCalledWith = err; };

    await requireFeature('hasEvents')(req, res, next);
    
    if (!nextCalledWith) {
      console.log('\u2705 SUCCESS: Access allowed for enabled feature');
      console.log('Attached Config:', req.orgConfig ? 'YES' : 'NO');
    } else {
      console.log('\u274C FAILURE: Access blocked for enabled feature:', nextCalledWith.message);
    }

    // 2. Test: Feature Disabled
    console.log('\n--- Scenario 2: Feature Disabled (hasEvents: false) ---');
    await mongoose.connection.db.collection('orgconfigs').updateOne(
      { organizationId: new mongoose.Types.ObjectId(orgId) }, 
      { $set: { 'features.hasEvents': false } }
    );
    
    req = { params: { orgId }, user: { role: 'admin', orgId }, id: 'test-2' };
    nextCalledWith = null;

    await requireFeature('hasEvents')(req, res, next);
    
    if (nextCalledWith && nextCalledWith.message.includes('Access denied')) {
      console.log('\u2705 SUCCESS: Access blocked for disabled feature');
      console.log('Error Message:', nextCalledWith.message);
    } else {
      console.log('\u274C FAILURE: Access allowed for disabled feature');
    }

    // 3. Test: System Admin Bypass
    console.log('\n--- Scenario 3: System Admin Bypass (hasEvents: false) ---');
    req = { params: { orgId }, user: { role: 'systemAdmin' }, id: 'test-3' };
    nextCalledWith = null;

    await requireFeature('hasEvents')(req, res, next);
    
    if (!nextCalledWith) {
      console.log('\u2705 SUCCESS: System Admin bypassed the check');
    } else {
      console.log('\u274C FAILURE: System Admin was blocked');
    }

    // 4. Test: Legacy Fallback (No Config)
    console.log('\n--- Scenario 4: Legacy Fallback (No Config) ---');
    await mongoose.connection.db.collection('orgconfigs').deleteOne(
      { organizationId: new mongoose.Types.ObjectId(orgId) }
    );
    
    req = { params: { orgId }, user: { role: 'admin', orgId }, id: 'test-4' };
    nextCalledWith = null;

    await requireFeature('hasEvents')(req, res, next);
    
    if (!nextCalledWith) {
      console.log('\u2705 SUCCESS: Legacy Fallback allowed access');
    } else {
      console.log('\u274C FAILURE: Legacy Fallback blocked access');
    }

    process.exit(0);
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
};

test();
