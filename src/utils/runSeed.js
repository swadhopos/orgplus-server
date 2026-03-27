const { initializeDatabase, closeDatabase } = require('../config/database');
const seedNiches = require('./seedNiches');

const run = async () => {
  try {
    await initializeDatabase();
    await seedNiches();
    console.log('Seeding completed successfully');
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

run();
