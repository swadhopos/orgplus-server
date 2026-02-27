import { describe, it, expect } from '@jest/globals';
import { logger, generateRequestId, createRequestLogger } from '../logger.js';

describe('Logger Utilities', () => {
  describe('generateRequestId', () => {
    it('should generate a valid UUID v4 format', () => {
      const requestId = generateRequestId();
      
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(requestId).toMatch(uuidRegex);
    });

    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('createRequestLogger', () => {
    it('should create a child logger with request ID', () => {
      const requestId = '12345678-1234-1234-1234-123456789012';
      const requestLogger = createRequestLogger(requestId);

      expect(requestLogger).toBeDefined();
      expect(typeof requestLogger.info).toBe('function');
      expect(typeof requestLogger.error).toBe('function');
    });

    it('should be a child of the main logger', () => {
      const requestId = 'test-request-id';
      const requestLogger = createRequestLogger(requestId);

      // Child logger should have the same level as parent
      expect(requestLogger.level).toBe(logger.level);
    });
  });

  describe('logger', () => {
    it('should be a winston logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should have file transports configured', () => {
      const transports = logger.transports;
      expect(transports.length).toBeGreaterThan(0);
      
      const fileTransports = transports.filter(
        t => t.constructor.name === 'File'
      );
      expect(fileTransports.length).toBeGreaterThanOrEqual(2);
    });

    it('should have correct log level', () => {
      const expectedLevel = process.env.LOG_LEVEL || 'info';
      expect(logger.level).toBe(expectedLevel);
    });

    it('should have error and combined log file transports', () => {
      const transports = logger.transports;
      const fileTransports = transports.filter(
        t => t.constructor.name === 'File'
      );
      
      const filenames = fileTransports.map(t => t.filename);
      expect(filenames.some(f => f.includes('error.log'))).toBe(true);
      expect(filenames.some(f => f.includes('combined.log'))).toBe(true);
    });
  });
});
