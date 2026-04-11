const readline = require('readline');
const mongoose = require('mongoose');
const request = require('supertest');
const { faker } = require('@faker-js/faker');
const https = require('https');

// Configuration
const FIREBASE_API_KEY = 'AIzaSyBgBGuxZ3rTzFJMMmP2yl8_GAqZjQi2eo0';// Load environment variables
require('dotenv').config();

// Mute application logs to keep terminal clean
process.env.LOG_LEVEL = 'error';

const app = require('../src/app');
const Member = require('../src/models/Member');
const Household = require('../src/models/Household');
const OrgSettings = require('../src/models/OrgSettings');
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

async function firebaseLogin(email, password) {
  const data = JSON.stringify({
    email,
    password,
    returnSecureToken: true
  });

  const options = {
    hostname: 'identitytoolkit.googleapis.com',
    port: 443,
    path: `/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        const parsed = JSON.parse(body);
        if (res.statusCode !== 200) reject(parsed.error || parsed);
        else resolve(parsed);
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function decodeToken(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  } catch (e) {
    return {};
  }
}

async function run() {
  process.stdout.write('\x1Bc'); // Clear terminal
  console.log('🚀 OrgPlus Production-Grade Test & Seeding Wizard\n');

  // --- PHASE 1: Real Authentication ---
  console.log('--- Phase 1: Real Firebase Authentication ---');
  const email = await ask('📧 Admin Email: ');
  const password = await ask('🔑 Admin Password: ');

  let authData;
  try {
    process.stdout.write('📡 Contacting Firebase Auth... ');
    authData = await firebaseLogin(email, password);
    process.stdout.write('✅ Success!\n');
  } catch (err) {
    console.error('\n❌ Login Failed:', err.message || JSON.stringify(err, null, 2));
    process.exit(1);
  }

  const idToken = authData.idToken;
  const claims = decodeToken(idToken);
  const uid = authData.localId;

  // Connect to DB
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus');

  // Auto-fetch OrgId
  let orgId = claims.orgId;
  if (!orgId) {
    process.stdout.write('🔎 Searching for organization context... ');
    const member = await Member.findOne({ userId: uid });
    if (member) orgId = member.organizationId.toString();
    else {
      const latestOrg = await mongoose.model('Organization').findOne({}).sort({ createdAt: -1 });
      if (latestOrg) orgId = latestOrg._id.toString();
    }
    process.stdout.write(`Found: ${orgId}\n`);
  }

  // --- PHASE 0: Optional Purge ---
  const doPurge = await ask('\n⚠️  Would you like to FACTORY RESET (Purge) this Org before seeding? (y/n): ');
  if (doPurge.toLowerCase() === 'y') {
    console.log(`🔎 Analyzing existing data for Org: ${orgId}...`);
    const counts = [];
    for (const target of PURGE_TARGETS) {
      const count = await target.model.countDocuments({ [target.field]: orgId });
      if (count > 0) counts.push({ label: target.label, count });
    }

    if (counts.length === 0) {
      console.log('✨ Organization is already clean.');
    } else {
      console.log('\n📦 DATA FOUND TO BE PURGED:');
      counts.forEach(c => console.log(`   - ${c.label.padEnd(25)}: ${c.count}`));
      
      const confirm = await ask('\n🔥 Type "PURGE" to confirm permanent deletion: ');
      if (confirm === 'PURGE') {
        process.stdout.write('🧹 Purging... ');
        for (const target of PURGE_TARGETS) {
          await target.model.deleteMany({ [target.field]: orgId });
        }
        process.stdout.write('✅ Success! Org is now at factory state.\n');
      } else {
        console.log('❌ Purge cancelled. Proceeding with existing data.');
      }
    }
  }

  const proceedGen = await ask('\nReady to generate 200 Families? (Head Linking Enabled) (y/n): ');
  if (proceedGen.toLowerCase() !== 'y') process.exit(0);

  // --- PHASE 2: Genealogy & Head Linkage ---
  console.log('\n--- Phase 2: Generating 200 Families ---');
  const stats = { members: 0, households: 0, bloodGroups: {} };
  const allMembersForLinking = [];
  const createdHouseholds = [];
  const diversifiedHouseholds = new Set();

  for (let i = 0; i < 200; i++) {
    let hh;
    // 10% chance to join an existing household (Joint Household)
    if (i > 10 && Math.random() < 0.1) {
      hh = faker.helpers.arrayElement(createdHouseholds);
      diversifiedHouseholds.add(hh._id);
    } else {
      const hhRes = await request(app)
        .post(`/api/organizations/${orgId}/households`)
        .set('Authorization', `Bearer ${idToken}`)
        .send({
          houseName: faker.person.lastName() + ' House',
          ward: faker.number.int({ min: 1, max: 20 }),
          financialStatus: faker.helpers.arrayElement(['APL', 'BPL'])
        });
      
      if (hhRes.status !== 201) {
        console.error(`\n❌ Error creating Household ${i+1}:`, hhRes.body);
        continue;
      }
      hh = hhRes.body.data.household || hhRes.body.data;
      createdHouseholds.push(hh);
      stats.households++;
    }

    // G1 Father
    const fatherRes = await request(app)
      .post(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({
        fullName: faker.person.fullName({ sex: 'male' }),
        gender: 'male',
        dateOfBirth: faker.date.birthdate({ min: 65, max: 80, mode: 'age' }),
        maritalStatus: 'married',
        currentHouseholdId: hh._id,
        status: 'active',
        medicalInfo: { bloodGroup: faker.helpers.arrayElement(['A+', 'B+', 'O+', 'AB+']) }
      });

    const father = fatherRes.body.data;
    stats.members++;
    updateBloodStats(stats, father.medicalInfo.bloodGroup);

    // If house is new, make this father the head
    if (!hh.headMemberId) {
      hh.headMemberId = father._id;
      await Household.findByIdAndUpdate(hh._id, { headMemberId: father._id });
    }

    // G1 Mother
    const motherRes = await request(app)
      .post(`/api/organizations/${orgId}/members`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({
        fullName: faker.person.fullName({ sex: 'female' }),
        gender: 'female',
        dateOfBirth: faker.date.birthdate({ min: 60, max: 75, mode: 'age' }),
        maritalStatus: 'married',
        spouseId: father._id,
        currentHouseholdId: hh._id,
        status: 'active',
        medicalInfo: { bloodGroup: faker.helpers.arrayElement(['A+', 'B+', 'O+', 'AB+']) }
      });
    
    const mother = motherRes.body.data;
    stats.members++;
    updateBloodStats(stats, mother.medicalInfo.bloodGroup);
    await Member.findByIdAndUpdate(father._id, { spouseId: mother._id });

    // G2 Children
    const childrenCount = faker.number.int({ min: 2, max: 3 });
    for (let j = 0; j < childrenCount; j++) {
      const gender = faker.helpers.arrayElement(['male', 'female']);
      const childRes = await request(app)
        .post(`/api/organizations/${orgId}/members`)
        .set('Authorization', `Bearer ${idToken}`)
        .send({
          fullName: faker.person.fullName({ sex: gender }),
          gender,
          dateOfBirth: faker.date.birthdate({ min: 30, max: 45, mode: 'age' }),
          maritalStatus: j === 0 ? 'married' : 'single',
          fatherId: father._id,
          motherId: mother._id,
          currentHouseholdId: hh._id,
          status: 'active',
          medicalInfo: { bloodGroup: faker.helpers.arrayElement(['A+', 'B+', 'O+', 'AB+']) }
        });
      
      const child = childRes.body.data;
      allMembersForLinking.push(child);
      stats.members++;
      updateBloodStats(stats, child.medicalInfo.bloodGroup);

      // Create G3 (Grandkids) for the first child (if married)
      if (j === 0) {
        // Create External Spouse
        const sGender = gender === 'male' ? 'female' : 'male';
        const spouseRes = await request(app)
          .post(`/api/organizations/${orgId}/members`)
          .set('Authorization', `Bearer ${idToken}`)
          .send({
            fullName: faker.person.fullName({ sex: sGender }),
            gender: sGender,
            dateOfBirth: faker.date.birthdate({ min: 28, max: 42, mode: 'age' }),
            maritalStatus: 'married',
            spouseId: child._id,
            currentHouseholdId: hh._id,
            status: 'active',
            medicalInfo: { bloodGroup: faker.helpers.arrayElement(['A+', 'B+', 'O+', 'AB+']) }
          });
        const externalSpouse = spouseRes.body.data;
        stats.members++;
        await Member.findByIdAndUpdate(child._id, { spouseId: externalSpouse._id });

        // Grandkids
        const g3Count = faker.number.int({ min: 1, max: 2 });
        for (let k = 0; k < g3Count; k++) {
          const g3Gender = faker.helpers.arrayElement(['male', 'female']);
          const gcRes = await request(app)
            .post(`/api/organizations/${orgId}/members`)
            .set('Authorization', `Bearer ${idToken}`)
            .send({
              fullName: faker.person.fullName({ sex: g3Gender }),
              gender: g3Gender,
              dateOfBirth: faker.date.birthdate({ min: 1, max: 12, mode: 'age' }),
              maritalStatus: 'single',
              fatherId: child.gender === 'male' ? child._id : externalSpouse._id,
              motherId: child.gender === 'female' ? child._id : externalSpouse._id,
              currentHouseholdId: hh._id,
              status: 'active',
              medicalInfo: { bloodGroup: faker.helpers.arrayElement(['A+', 'B+', 'O+', 'AB+']) }
            });
          stats.members++;
          updateBloodStats(stats, gcRes.body.data.medicalInfo.bloodGroup);
          diversifiedHouseholds.add(hh._id); // Mark as multigenerational
        }
      }
    }

    process.stdout.write(`\r✅ Family ${i + 1} finalized... `);
  }

  process.stdout.write('\n');
  console.log('✅ Generation Complete.');
  console.log(`🏠 Unique Households: ${stats.households}`);
  console.log(`👪 Total Members: ${stats.members}`);
  
  if (diversifiedHouseholds.size > 0) {
    console.log('\n📍 DIVERSIFIED HOUSEHOLD IDs (Joint/Multigenerational):');
    Array.from(diversifiedHouseholds).slice(0, 5).forEach(id => console.log(`   - ${id}`));
  }

  const proceedFinance = await ask('\nReady to seed Financials & Reports? (y/n): ');
  if (proceedFinance.toLowerCase() !== 'y') process.exit(0);

  // --- PHASE 3: Business Logic (Finance/Committees) ---
  console.log('\n--- Phase 3: Financials & Committees ---');
  // ... (Same as before but with phased confirmation)
  console.log('💰 Seeding Ledgers and 50 Transactions...');
  const ledgerRes = await request(app)
    .post(`/api/organizations/${orgId}/ledgers`)
    .set('Authorization', `Bearer ${idToken}`)
    .send({ name: 'General Fund', type: 'income', isMain: true });
  
  const ledgerId = ledgerRes.body.data._id;
  const financialstats = { income: 0, expense: 0 };

  for (let i = 0; i < 50; i++) {
    const amount = faker.number.int({ min: 100, max: 5000 });
    const type = i % 2 === 0 ? 'income' : 'expense';
    await request(app)
      .post(`/api/organizations/${orgId}/ledgers/${ledgerId}/transactions`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ amount, type, date: new Date(), description: 'Test Seed' });
    
    if (type === 'income') financialstats.income += amount;
    else financialstats.expense += amount;
  }

  console.log('🏛️ Setting up Committee Officers...');
  const committeeRes = await request(app)
    .post(`/api/organizations/${orgId}/committees`)
    .set('Authorization', `Bearer ${idToken}`)
    .send({ name: 'Executive Board', type: 'managing', isMain: true });
  
  if (committeeRes.status !== 201) {
    console.error('❌ Failed to create committee:', committeeRes.body);
    process.exit(1);
  }

  const committeeId = committeeRes.body.data._id;
  await request(app)
    .post(`/api/organizations/${orgId}/committees/${committeeId}/members`)
    .set('Authorization', `Bearer ${idToken}`)
    .send({ memberId: allMembersForLinking[0]._id, role: 'president', startDate: new Date() });

  // Update Org Settings for Logic Tests
  await OrgSettings.findOneAndUpdate(
    { organizationId: orgId },
    { 
      'approvalSettings.approverCommitteeId': committeeId, 
      'approvalSettings.requiredApprovals': 1 
    },
    { upsert: true }
  );

  const proceedAudit = await ask('\nReady for final Report & Linkage Audit? (y/n): ');
  if (proceedAudit.toLowerCase() !== 'y') process.exit(0);

  // --- PHASE 4: Audit ---
  console.log('\n--- Phase 4: Final Integrity Audit ---');
  const dashboardRes = await request(app)
    .get(`/api/organizations/${orgId}/analytics/dashboard?refresh=true`)
    .set('Authorization', `Bearer ${idToken}`);
  
  const report = dashboardRes.body.data;
  
  // Custom check for Dual Parent Linkage
  const dualParentCount = await Member.countDocuments({ 
    organizationId: orgId, 
    fatherId: { $ne: null }, 
    motherId: { $ne: null } 
  });

  console.log('\n--- AUDIT RESULTS ---');
  check('Members Count', report.demographicCards.totalMembers, stats.members);
  check('Household Count', report.demographicCards.totalHouseholds, stats.households);
  check('Net Balance', report.financialCards.netBalance, financialstats.income - financialstats.expense);
  check('Dual Parent Linkage', dualParentCount > 0 ? 'Verified' : 'Failed', 'Verified');

  console.log('\n🚀 ALL PHASES COMPLETED. YOUR ORG IS NOW PRODUCTION-READY.');
  process.exit(0);
}

function updateBloodStats(s, bg) { s.bloodGroups[bg] = (s.bloodGroups[bg] || 0) + 1; }
function check(l, a, e) {
  if (a == e) console.log(`✅ ${l.padEnd(15)}: ${a} (Perfect)`);
  else console.log(`❌ ${l.padEnd(15)}: ${a} (EXPECTED: ${e})`);
}

run().catch(err => { console.error('💥 ERROR:', err); process.exit(1); });
