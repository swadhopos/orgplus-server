const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

/**
 * MongoDB Connection Configuration
 * 
 * This module handles MongoDB connection with:
 * - Connection pooling for efficient resource usage
 * - Retry logic with exponential backoff
 * - Connection event listeners for monitoring
 */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus';
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Calculate exponential backoff delay
 * @param {number} retryCount - Current retry attempt number
 * @returns {number} Delay in milliseconds
 */
const getRetryDelay = (retryCount) => {
  return INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Connect to MongoDB with retry logic
 * @param {number} retryCount - Current retry attempt (default: 0)
 * @returns {Promise<void>}
 */
const connectDB = async (retryCount = 0) => {
  try {
    // Mongoose connection options with connection pooling
    const options = {
      maxPoolSize: 10,        // Maximum number of connections in the pool
      minPoolSize: 2,         // Minimum number of connections in the pool
      serverSelectionTimeoutMS: 5000,  // Timeout for server selection
      socketTimeoutMS: 45000,          // Timeout for socket operations
      family: 4,              // Use IPv4, skip trying IPv6
    };

    console.log(`Attempting to connect to MongoDB at ${MONGODB_URI}...`);
    
    await mongoose.connect(MONGODB_URI, options);
    
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error(`MongoDB connection error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
    
    if (retryCount < MAX_RETRIES - 1) {
      const delay = getRetryDelay(retryCount);
      console.log(`Retrying connection in ${delay}ms...`);
      await sleep(delay);
      return connectDB(retryCount + 1);
    } else {
      console.error('Max retry attempts reached. Could not connect to MongoDB.');
      throw error;
    }
  }
};

/**
 * Set up MongoDB connection event listeners
 */
const setupEventListeners = () => {
  // Connection successful
  mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
  });

  // Connection error
  mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
  });

  // Connection disconnected
  mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB');
  });

  // Application termination - close connection gracefully
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      console.log('Mongoose connection closed through app termination');
      process.exit(0);
    } catch (err) {
      console.error('Error closing mongoose connection:', err);
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
  });
};

/**
 * Initialize MongoDB connection with event listeners
 * @returns {Promise<void>}
 */
const initializeDatabase = async () => {
  setupEventListeners();
  await connectDB();
};

/**
 * Close MongoDB connection
 * @returns {Promise<void>}
 */
const closeDatabase = async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
    throw error;
  }
};

/**
 * Get connection status
 * @returns {string} Connection state
 */
const getConnectionStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

module.exports = {
  connectDatabase: initializeDatabase,
  initializeDatabase,
  closeDatabase,
  getConnectionStatus,
  connectDB
};
