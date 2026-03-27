const mongoose = require('mongoose');
const seedNiches = require('./src/utils/seedNiches');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus';

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for final migration');
    await seedNiches();
    console.log('Niche Migration Complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

run();
