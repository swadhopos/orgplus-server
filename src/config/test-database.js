/**
 * Test script to verify MongoDB connection
 * Run with: node src/config/test-database.js
 */

import { initializeDatabase, closeDatabase, getConnectionStatus } from './database.js';

const testConnection = async () => {
  try {
    console.log('Starting MongoDB connection test...\n');
    
    // Test initial status
    console.log('Initial connection status:', getConnectionStatus());
    
    // Initialize database connection
    console.log('\nInitializing database connection...');
    await initializeDatabase();
    
    // Check status after connection
    console.log('\nConnection status after initialization:', getConnectionStatus());
    
    // Wait a moment to ensure connection is stable
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n✓ MongoDB connection test successful!');
    console.log('Connection details:');
    console.log('  - Host:', process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus');
    console.log('  - Status:', getConnectionStatus());
    console.log('  - Database:', 'orgplus');
    
    // Close connection
    console.log('\nClosing connection...');
    await closeDatabase();
    console.log('Final connection status:', getConnectionStatus());
    
    console.log('\n✓ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ MongoDB connection test failed!');
    console.error('Error:', error.message);
    process.exit(1);
  }
};

testConnection();
