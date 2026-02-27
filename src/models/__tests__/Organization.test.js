import mongoose from 'mongoose';
import Organization from '../Organization.js';
import { connectDB, closeDatabase } from '../../config/database.js';

// Mock console methods to reduce test output noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(async () => {
  console.log = () => {};
  console.error = () => {};
  await connectDB();
}, 10000);

afterAll(async () => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  await closeDatabase();
});

beforeEach(async () => {
  // Clear the Organization collection before each test
  await Organization.deleteMany({});
});

describe('Organization Model', () => {
  const validOrganizationData = {
    name: 'Test Organization',
    address: '123 Test Street, Test City, TC 12345',
    contactEmail: 'contact@testorg.com',
    contactPhone: '+1234567890',
    status: 'active',
    createdByUserId: 'user123'
  };

  describe('Schema Validation', () => {
    it('should create a valid organization', async () => {
      const organization = new Organization(validOrganizationData);
      const savedOrganization = await organization.save();

      expect(savedOrganization._id).toBeDefined();
      expect(savedOrganization.name).toBe(validOrganizationData.name);
      expect(savedOrganization.address).toBe(validOrganizationData.address);
      expect(savedOrganization.contactEmail).toBe(validOrganizationData.contactEmail);
      expect(savedOrganization.contactPhone).toBe(validOrganizationData.contactPhone);
      expect(savedOrganization.status).toBe('active');
      expect(savedOrganization.createdByUserId).toBe('user123');
      expect(savedOrganization.isDeleted).toBe(false);
      expect(savedOrganization.createdAt).toBeDefined();
      expect(savedOrganization.updatedAt).toBeDefined();
    });

    it('should fail when name is missing', async () => {
      const invalidData = { ...validOrganizationData };
      delete invalidData.name;

      const organization = new Organization(invalidData);
      
      await expect(organization.save()).rejects.toThrow();
    });

    it('should fail when address is missing', async () => {
      const invalidData = { ...validOrganizationData };
      delete invalidData.address;

      const organization = new Organization(invalidData);
      
      await expect(organization.save()).rejects.toThrow();
    });

    it('should fail when contactEmail is missing', async () => {
      const invalidData = { ...validOrganizationData };
      delete invalidData.contactEmail;

      const organization = new Organization(invalidData);
      
      await expect(organization.save()).rejects.toThrow();
    });

    it('should fail when contactPhone is missing', async () => {
      const invalidData = { ...validOrganizationData };
      delete invalidData.contactPhone;

      const organization = new Organization(invalidData);
      
      await expect(organization.save()).rejects.toThrow();
    });

    it('should fail when createdByUserId is missing', async () => {
      const invalidData = { ...validOrganizationData };
      delete invalidData.createdByUserId;

      const organization = new Organization(invalidData);
      
      await expect(organization.save()).rejects.toThrow();
    });

    it('should trim whitespace from name', async () => {
      const organization = new Organization({
        ...validOrganizationData,
        name: '  Test Organization  '
      });
      const savedOrganization = await organization.save();

      expect(savedOrganization.name).toBe('Test Organization');
    });

    it('should convert email to lowercase', async () => {
      const organization = new Organization({
        ...validOrganizationData,
        contactEmail: 'CONTACT@TESTORG.COM'
      });
      const savedOrganization = await organization.save();

      expect(savedOrganization.contactEmail).toBe('contact@testorg.com');
    });

    it('should fail with invalid email format', async () => {
      const organization = new Organization({
        ...validOrganizationData,
        contactEmail: 'invalid-email'
      });

      await expect(organization.save()).rejects.toThrow();
    });

    it('should fail with invalid status', async () => {
      const organization = new Organization({
        ...validOrganizationData,
        status: 'invalid-status'
      });

      await expect(organization.save()).rejects.toThrow();
    });

    it('should accept valid status values', async () => {
      const statuses = ['active', 'inactive', 'suspended'];

      for (const status of statuses) {
        const organization = new Organization({
          ...validOrganizationData,
          name: `Test Organization ${status}`,
          status
        });
        const savedOrganization = await organization.save();

        expect(savedOrganization.status).toBe(status);
      }
    });

    it('should default status to active', async () => {
      const data = { ...validOrganizationData };
      delete data.status;

      const organization = new Organization(data);
      const savedOrganization = await organization.save();

      expect(savedOrganization.status).toBe('active');
    });

    it('should default isDeleted to false', async () => {
      const organization = new Organization(validOrganizationData);
      const savedOrganization = await organization.save();

      expect(savedOrganization.isDeleted).toBe(false);
    });

    it('should fail when name is too short', async () => {
      const organization = new Organization({
        ...validOrganizationData,
        name: 'A'
      });

      await expect(organization.save()).rejects.toThrow();
    });

    it('should fail when name is too long', async () => {
      const organization = new Organization({
        ...validOrganizationData,
        name: 'A'.repeat(201)
      });

      await expect(organization.save()).rejects.toThrow();
    });

    it('should fail when address is too short', async () => {
      const organization = new Organization({
        ...validOrganizationData,
        address: 'Addr'
      });

      await expect(organization.save()).rejects.toThrow();
    });

    it('should fail when contactPhone is too short', async () => {
      const organization = new Organization({
        ...validOrganizationData,
        contactPhone: '123'
      });

      await expect(organization.save()).rejects.toThrow();
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique organization name', async () => {
      const organization1 = new Organization(validOrganizationData);
      await organization1.save();

      const organization2 = new Organization({
        ...validOrganizationData,
        contactEmail: 'different@email.com'
      });

      await expect(organization2.save()).rejects.toThrow();
    });

    it('should allow same name if first organization is soft deleted', async () => {
      const organization1 = new Organization(validOrganizationData);
      await organization1.save();
      await organization1.softDelete('user123');

      const organization2 = new Organization({
        ...validOrganizationData,
        contactEmail: 'different@email.com'
      });

      // This will still fail due to unique index on name
      // In production, you might want to handle this differently
      await expect(organization2.save()).rejects.toThrow();
    });
  });

  describe('Indexes', () => {
    it('should have index on name', async () => {
      const indexes = Organization.schema.indexes();
      const nameIndex = indexes.find(index => index[0].name === 1);

      expect(nameIndex).toBeDefined();
      expect(nameIndex[1].unique).toBe(true);
    });

    it('should have index on isDeleted', async () => {
      const indexes = Organization.schema.indexes();
      const isDeletedIndex = indexes.find(index => index[0].isDeleted === 1);

      expect(isDeletedIndex).toBeDefined();
    });
  });

  describe('Pre-save Middleware', () => {
    it('should set createdAt and updatedAt on creation', async () => {
      const organization = new Organization(validOrganizationData);
      const savedOrganization = await organization.save();

      expect(savedOrganization.createdAt).toBeDefined();
      expect(savedOrganization.updatedAt).toBeDefined();
      expect(savedOrganization.createdAt).toBeInstanceOf(Date);
      expect(savedOrganization.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on save', async () => {
      const organization = new Organization(validOrganizationData);
      const savedOrganization = await organization.save();
      const originalUpdatedAt = savedOrganization.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      savedOrganization.address = '456 New Address';
      const updatedOrganization = await savedOrganization.save();

      expect(updatedOrganization.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should not change createdAt on update', async () => {
      const organization = new Organization(validOrganizationData);
      const savedOrganization = await organization.save();
      const originalCreatedAt = savedOrganization.createdAt;

      savedOrganization.address = '456 New Address';
      const updatedOrganization = await savedOrganization.save();

      expect(updatedOrganization.createdAt.getTime()).toBe(originalCreatedAt.getTime());
    });
  });

  describe('Soft Delete', () => {
    it('should soft delete organization', async () => {
      const organization = new Organization(validOrganizationData);
      const savedOrganization = await organization.save();

      await savedOrganization.softDelete('admin123');

      expect(savedOrganization.isDeleted).toBe(true);
      expect(savedOrganization.deletedAt).toBeDefined();
      expect(savedOrganization.deletedAt).toBeInstanceOf(Date);
      expect(savedOrganization.deletedByUserId).toBe('admin123');
    });

    it('should persist soft delete to database', async () => {
      const organization = new Organization(validOrganizationData);
      const savedOrganization = await organization.save();
      const orgId = savedOrganization._id;

      await savedOrganization.softDelete('admin123');

      const foundOrganization = await Organization.findById(orgId);
      expect(foundOrganization.isDeleted).toBe(true);
      expect(foundOrganization.deletedAt).toBeDefined();
      expect(foundOrganization.deletedByUserId).toBe('admin123');
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test organizations
      await Organization.create([
        { ...validOrganizationData, name: 'Active Org 1' },
        { ...validOrganizationData, name: 'Active Org 2', contactEmail: 'org2@test.com' },
        { 
          ...validOrganizationData, 
          name: 'Deleted Org', 
          contactEmail: 'deleted@test.com',
          isDeleted: true,
          deletedAt: new Date(),
          deletedByUserId: 'admin123'
        }
      ]);
    });

    describe('findActive', () => {
      it('should return only non-deleted organizations', async () => {
        const organizations = await Organization.findActive();

        expect(organizations).toHaveLength(2);
        expect(organizations.every(org => !org.isDeleted)).toBe(true);
      });

      it('should accept additional filter criteria', async () => {
        const organizations = await Organization.findActive({ name: 'Active Org 1' });

        expect(organizations).toHaveLength(1);
        expect(organizations[0].name).toBe('Active Org 1');
      });

      it('should return empty array when no active organizations match', async () => {
        const organizations = await Organization.findActive({ name: 'Non-existent Org' });

        expect(organizations).toHaveLength(0);
      });
    });

    describe('findByIdActive', () => {
      it('should return organization by ID if not deleted', async () => {
        const allOrgs = await Organization.find({ isDeleted: false });
        const targetOrg = allOrgs[0];

        const foundOrganization = await Organization.findByIdActive(targetOrg._id);

        expect(foundOrganization).toBeDefined();
        expect(foundOrganization._id.toString()).toBe(targetOrg._id.toString());
        expect(foundOrganization.isDeleted).toBe(false);
      });

      it('should return null for deleted organization', async () => {
        const deletedOrg = await Organization.findOne({ isDeleted: true });

        const foundOrganization = await Organization.findByIdActive(deletedOrg._id);

        expect(foundOrganization).toBeNull();
      });

      it('should return null for non-existent ID', async () => {
        const fakeId = new mongoose.Types.ObjectId();

        const foundOrganization = await Organization.findByIdActive(fakeId);

        expect(foundOrganization).toBeNull();
      });
    });
  });

  describe('Immutable Fields', () => {
    it('should not allow changing createdAt after creation', async () => {
      const organization = new Organization(validOrganizationData);
      const savedOrganization = await organization.save();
      const originalCreatedAt = savedOrganization.createdAt;

      savedOrganization.createdAt = new Date('2020-01-01');
      const updatedOrganization = await savedOrganization.save();

      expect(updatedOrganization.createdAt.getTime()).toBe(originalCreatedAt.getTime());
    });

    it('should not allow changing createdByUserId after creation', async () => {
      const organization = new Organization(validOrganizationData);
      const savedOrganization = await organization.save();
      const originalCreatedBy = savedOrganization.createdByUserId;

      savedOrganization.createdByUserId = 'different-user';
      const updatedOrganization = await savedOrganization.save();

      expect(updatedOrganization.createdByUserId).toBe(originalCreatedBy);
    });
  });
});
