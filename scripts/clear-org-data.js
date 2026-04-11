const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

// Import Models
const Member = require('../src/models/Member');
const Household = require('../src/models/Household');
const Committee = require('../src/models/Committee');
const CommitteeMember = require('../src/models/CommitteeMember');
const Ledger = require('../src/models/Ledger');
const Transaction = require('../src/models/Transaction');
const MarriageNOC = require('../src/models/MarriageNOC');
const MarriageCertificate = require('../src/models/MarriageCertificate');
const DeathRegister = require('../src/models/DeathRegister');
const Event = require('../src/models/Event');
const Fundraiser = require('../src/models/Fundraiser');
const FeePlan = require('../src/models/FeePlan');
const Subscription = require('../src/models/Subscription');
const Attendance = require('../src/models/Attendance');
const CalendarBooking = require('../src/models/CalendarBooking');
const Meeting = require('../src/models/Meeting');
const Notice = require('../src/models/Notice');
const Sponsor = require('../src/models/Sponsor');
const Staff = require('../src/models/Staff');
const SupportTicket = require('../src/models/SupportTicket');
const AnalyticsCache = require('../src/models/AnalyticsCache');
const Counter = require('../src/models/Counter');
const CapacityCategory = require('../src/models/CapacityCategory');

const PURGE_TARGETS = [
  { model: Member, label: 'Members', field: 'organizationId' },
  { model: Household, label: 'Households', field: 'organizationId' },
  { model: Committee, label: 'Committees', field: 'organizationId' },
  { model: CommitteeMember, label: 'Committee Memberships', field: 'organizationId' },
  { model: Ledger, label: 'Ledgers', field: 'organizationId' },
  { model: Transaction, label: 'Transactions', field: 'organizationId' },
  { model: MarriageNOC, label: 'Marriage NOCs', field: 'organizationId' },
  { model: MarriageCertificate, label: 'Marriage Certificates', field: 'organizationId' },
  { model: DeathRegister, label: 'Death Register Entries', field: 'organizationId' },
  { model: Event, label: 'Events', field: 'organizationId' },
  { model: Fundraiser, label: 'Fundraisers', field: 'organizationId' },
  { model: FeePlan, label: 'Fee Plans', field: 'organizationId' },
  { model: Subscription, label: 'Subscriptions', field: 'organizationId' },
  { model: Attendance, label: 'Attendance Records', field: 'organizationId' },
  { model: CalendarBooking, label: 'Calendar Bookings', field: 'organizationId' },
  { model: Meeting, label: 'Meetings', field: 'organizationId' },
  { model: Notice, label: 'Notices', field: 'organizationId' },
  { model: Sponsor, label: 'Sponsors', field: 'organizationId' },
  { model: Staff, label: 'Staff Members', field: 'organizationId' },
  { model: SupportTicket, label: 'Support Tickets', field: 'organization' },
  { model: AnalyticsCache, label: 'Analytics Caches', field: 'organizationId' },
  { model: Counter, label: 'Sequence Counters', field: 'organizationId' },
  { model: CapacityCategory, label: 'Capacity Categories', field: 'organizationId' }
];

async function run() {
  process.stdout.write('\x1Bc'); // Clear terminal
  console.log('☢️ OrgPlus Organization Data Purge Wizard');
  console.log('========================================\n');

  const orgId = process.argv[2] || await ask('📍 Enter Organization ID to clear: ');
  if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
    console.error('❌ Invalid Organization ID.');
    process.exit(1);
  }

  try {
    console.log('📡 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus');
    console.log('✅ Connected.\n');

    console.log(`🔎 Analyzing data for Org: ${orgId}...`);
    const counts = [];
    for (const target of PURGE_TARGETS) {
      const count = await target.model.countDocuments({ [target.field]: orgId });
      if (count > 0) counts.push({ label: target.label, count });
    }

    if (counts.length === 0) {
      console.log('✨ No transactional data found for this organization. It is already clean!');
      process.exit(0);
    }

    console.log('\n📦 DATA FOUND TO BE PURGED:');
    counts.forEach(c => console.log(`   - ${c.label.padEnd(25)}: ${c.count}`));

    console.log('\n⚠️  WARNING: This will permanently delete the records listed above.');
    console.log('   Organization, Config, and Settings will be PRESERVED.');
    
    const confirm = await ask('\n🔥 Are you absolutely sure? Type "PURGE" to continue: ');
    
    if (confirm !== 'PURGE') {
      console.log('❌ Purge cancelled.');
      process.exit(0);
    }

    console.log('\n🧹 Purging data...');
    for (const target of PURGE_TARGETS) {
      const result = await target.model.deleteMany({ [target.field]: orgId });
      if (result.deletedCount > 0) {
        console.log(`   ✅ Cleared ${result.deletedCount} ${target.label}`);
      }
    }

    console.log('\n🚀 ALL DATA CLEARED SUCCESSFULLY.');
    console.log('Organization foundation is now reset to factory state.');
    process.exit(0);
  } catch (err) {
    console.error('💥 ERROR during purge:', err);
    process.exit(1);
  }
}

run();
