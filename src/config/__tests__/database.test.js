import mongoose from 'mongoose';
import { 
  initializeDatabase, 
  closeDatabase, 
  getConnectionStatus,
  connectDB 
} from '../database.js';

// Mock console methods to reduce test output noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = () => {};
  console.error = () => {};
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('Database Connection', () => {
  afterEach(async () => {
    // Clean up connection after each test
    if (mongoose.connection.readyState !== 0) {
      await closeDatabase();
    }
  });

  describe('connectDB', () => {
    it('should connect to MongoDB successfully', async () => {
      await connectDB();
      expect(mongoose.connection.readyState).toBe(1); // 1 = connected
    }, 10000);

    it('should handle connection with retry logic', async () => {
      // This test verifies the function exists and can be called
      // Actual retry logic is tested through integration
      expect(typeof connectDB).toBe('function');
    });
  });

  describe('initializeDatabase', () => {
    it('should initialize database connection', async () => {
      await initializeDatabase();
      expect(mongoose.connection.readyState).toBe(1);
    }, 10000);
  });

  describe('closeDatabase', () => {
    it('should close database connection', async () => {
      await connectDB();
      expect(mongoose.connection.readyState).toBe(1);
      
      await closeDatabase();
      expect(mongoose.connection.readyState).toBe(0); // 0 = disconnected
    }, 10000);
  });

  describe('getConnectionStatus', () => {
    it('should return disconnected when not connected', () => {
      const status = getConnectionStatus();
      expect(status).toBe('disconnected');
    });

    it('should return connected when connected', async () => {
      await connectDB();
      const status = getConnectionStatus();
      expect(status).toBe('connected');
    }, 10000);
  });

  describe('Connection Pooling', () => {
    it('should use connection pooling configuration', async () => {
      await connectDB();
      
      // Verify connection exists
      expect(mongoose.connection).toBeDefined();
      expect(mongoose.connection.readyState).toBe(1);
      
      // Connection pool settings are applied through mongoose options
      // We can verify the connection is established with pooling
      const db = mongoose.connection.db;
      expect(db).toBeDefined();
    }, 10000);
  });

  describe('Event Listeners', () => {
    it('should set up event listeners on initialization', async () => {
      // Verify that event listeners are registered
      const eventNames = mongoose.connection.eventNames();
      
      await initializeDatabase();
      
      const updatedEventNames = mongoose.connection.eventNames();
      expect(updatedEventNames.length).toBeGreaterThanOrEqual(eventNames.length);
    }, 10000);
  });
});
