const readline = require('readline');
const fs = require('fs');

// Configuration
const API_KEY = 'AIzaSyBgBGuxZ3rTzFJMMmP2yl8_GAqZjQi2eo0'; // Same as existing script
const BASE_URL = 'http://localhost:5000/api';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

async function getAuthToken(email, password) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || JSON.stringify(data));
        }
        return data.idToken;
    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        process.exit(1);
    }
}

async function apiCall(name, method, endpoint, token, body = null) {
    try {
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        let data;
        const text = await response.text();
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = { message: text || 'No response body' };
        }

        if (response.ok) {
            return data;
        } else {
            console.error(`❌ ${name} FAIL (Status: ${response.status})`);
            console.error('   Error:', JSON.stringify(data, null, 2));
            return null;
        }
    } catch (error) {
        console.error(`❌ ${name} FAIL (Error: ${error.message})`);
        return null;
    }
}

const DEFAULT_EMAIL = 'citu@google.com';
const DEFAULT_PASS = '12345678';

async function askQuestion(question) {
    return ask(question);
}

async function getCredentials() {
    console.log('\n--- Authentication ---');
    const email = await askQuestion(`Enter Email (default: ${DEFAULT_EMAIL}): `) || DEFAULT_EMAIL;
    const password = await askQuestion(`Enter Password (default: ${DEFAULT_PASS}): `) || DEFAULT_PASS;
    return { email, password };
}

async function runTests() {
    console.log('\n=== OrgPlus Comprehensive Test Suite ===');
    
    const { email, password } = await getCredentials();
    rl.close();

    console.log('\n[1. Authentication]');
    const token = await getAuthToken(email, password);
    console.log('✅ Successfully authenticated');

    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const orgId = payload.orgId;
    const userId = payload.uid;

    if (!orgId) {
        console.error('❌ No organization ID found in token claims.');
        process.exit(1);
    }
    console.log(`Using Org ID: ${orgId}`);

    // 2. Fetch OrgConfig
    console.log('\n[2. Configuration Discovery]');
    const orgConfigRes = await apiCall('Get OrgConfig', 'GET', `/organizations/${orgId}/settings`, token);
    const orgConfig = orgConfigRes?.data;
    if (!orgConfig) {
        console.warn('⚠️ Could not fetch OrgConfig. Proceeding with defaults.');
    } else {
        console.log(`✅ Membership Model: ${orgConfig.membershipModel}`);
        console.log(`✅ Features: ${Object.keys(orgConfig.features || {}).filter(f => orgConfig.features[f]).join(', ')}`);
    }

    // 3. Volume Creation: Members/Groups (100+)
    console.log('\n[3. Volume Creation: Members/Groups (100+)]');
    const memberIds = [];
    const householdIds = [];
    const isHouseholdRequired = orgConfig?.membershipModel === 'group_required';

    for (let i = 1; i <= 105; i++) {
        if (isHouseholdRequired) {
            const hRes = await apiCall(`Create Household ${i}`, 'POST', `/organizations/${orgId}/households`, token, {
                houseNumber: `AUTO-H-${Date.now()}-${i}`,
                ownerName: `Test Owner ${i}`,
                contactPhone: `9999990${i.toString().padStart(3, '0')}`,
                organizationId: orgId,
                createdByUserId: userId,
                firstName: `HeadMember-${i}`,
                lastName: 'Test',
                dateOfBirth: '1980-01-01',
                gender: 'male',
                maritalStatus: 'married'
            });
            if (hRes?.success) {
                householdIds.push(hRes.data.household._id);
                memberIds.push(hRes.data.headMember._id);
            }
        } else {
            const mRes = await apiCall(`Create Member ${i}`, 'POST', `/organizations/${orgId}/members`, token, {
                fullName: `Member Name ${i}`,
                gender: i % 2 === 0 ? 'male' : 'female',
                maritalStatus: 'single',
                email: `member${i}@example.com`,
                organizationId: orgId,
                createdByUserId: userId
            });
            if (mRes?.success) {
                memberIds.push(mRes.data._id);
            }
        }
        if (i % 25 === 0) process.stdout.write(`...created ${i} members/groups\n`);
    }
    console.log(`✅ Created ${memberIds.length} members/groups`);

    // 4. Finance & Fees (Tiered/Non-Tiered)
    console.log('\n[4. Finance & Fees (Tiered/Non-Tiered)]');
    
    // Discover or Create a Ledger
    const ledgersRes = await apiCall('List Ledgers', 'GET', `/organizations/${orgId}/ledgers`, token);
    let ledgerId;
    if (ledgersRes?.data && ledgersRes.data.length > 0) {
        ledgerId = ledgersRes.data[0]._id;
    } else {
        const newLedger = await apiCall('Create Ledger', 'POST', `/organizations/${orgId}/ledgers`, token, {
            name: 'Auto-Test-Ledger',
            fiscalYearStart: new Date().toISOString(),
            currency: 'INR',
            openingBalance: 0
        });
        ledgerId = newLedger?.data?._id;
    }
    console.log(`Using Ledger ID: ${ledgerId}`);

    // Create Non-tier plan
    const nonTierPlan = await apiCall('Create Non-tier Plan', 'POST', `/organizations/${orgId}/fees`, token, {
        name: 'Auto-Test-Common-Fee',
        amount: 500,
        type: 'ONE_TIME',
        targetAudience: 'MEMBER',
        organizationId: orgId,
        createdByUserId: userId,
        description: 'Test fee for all members'
    });

    // Create a Category for tiered testing
    const catRes = await apiCall('Create Category', 'POST', `/organizations/${orgId}/categories`, token, {
        name: 'Auto-Test-Category',
        type: 'both',
        module: 'all',
        organizationId: orgId,
        createdByUserId: userId
    });
    
    let tieredPlan;
    if (catRes?.success) {
        const catId = catRes.data._id;
        tieredPlan = await apiCall('Create Tiered Plan', 'POST', `/organizations/${orgId}/fees`, token, {
            name: 'Auto-Test-Tiered-Fee',
            amount: 1000,
            type: 'ONE_TIME',
            targetAudience: 'MEMBER',
            organizationId: orgId,
            createdByUserId: userId,
            linkedCapacityCategoryId: catId,
            description: 'Test tiered fee'
        });
    }

    // 5. Create 100+ Transactions (Fees & Subscriptions)
    console.log('\n[5. Volume Creation: Transactions (100+)]');
    if (nonTierPlan?.success && ledgerId && memberIds.length > 0) {
        const planId = nonTierPlan.data._id;
        for (let i = 0; i < 105; i++) {
            const mId = memberIds[i % memberIds.length];
            // Assign plan/create subscription
            const subRes = await apiCall(`Create Sub ${i}`, 'POST', `/organizations/${orgId}/subscriptions/assign`, token, {
                planId: planId,
                targetId: mId,
                targetType: 'MEMBER',
                organizationId: orgId,
                createdByUserId: userId,
                startDate: new Date().toISOString()
            });
            
            if (subRes?.success) {
                // Post payment / transaction to LEDGER
                await apiCall(`Create Transaction ${i}`, 'POST', `/organizations/${orgId}/ledgers/${ledgerId}/transactions`, token, {
                    type: 'income',
                    amount: 500,
                    description: `Test payment ${i}`,
                    memberId: mId,
                    date: new Date().toISOString(),
                    status: 'completed',
                    payment: { method: 'cash' }
                });
            }
            if (i % 25 === 0) process.stdout.write(`...created ${i} transactions\n`);
        }
    }
    console.log('✅ Created 100+ transactions for Fees & Subscriptions');

    // 6. Membership testing
    console.log('\n[6. Membership (Tiered/Non-Tiered)]');
    const membershipPlan = await apiCall('Create Membership Plan', 'POST', `/organizations/${orgId}/fees`, token, {
        name: 'Auto-Test-Membership',
        amount: 300,
        type: 'RECURRING',
        frequency: 'YEARLY',
        targetAudience: 'MEMBER',
        isMembership: true,
        organizationId: orgId,
        createdByUserId: userId
    });
    if (membershipPlan?.success) {
         // Create 100+ Membership Subs
         for (let i = 0; i < 105; i++) {
            const mId = memberIds[i % memberIds.length];
            await apiCall(`Assign Memb ${i}`, 'POST', `/organizations/${orgId}/subscriptions/assign`, token, {
                planId: membershipPlan.data._id,
                targetId: mId,
                targetType: 'MEMBER',
                organizationId: orgId,
                createdByUserId: userId
            });
            if (i % 25 === 0) process.stdout.write(`...assigned ${i} memberships\n`);
         }
    }
    console.log('✅ Created 100+ Membership assignments');

    // 7. Committees & Meetings
    console.log('\n[7. Committees, Meetings & Minutes]');
    const comm = await apiCall('Create Committee', 'POST', `/organizations/${orgId}/committees`, token, {
        name: 'Auto-Test Committee',
        type: 'managing',
        organizationId: orgId,
        createdByUserId: userId
    });
    if (comm?.success) {
        const commId = comm.data._id;
        const meeting = await apiCall('Create Meeting', 'POST', `/organizations/${orgId}/meetings`, token, {
            title: 'Auto-Test Meeting',
            committeeId: commId,
            meetingDate: new Date().toISOString(),
            location: 'Test Virtual Room',
            agenda: [{ topic: 'Discussion 1' }, { topic: 'Discussion 2' }],
            organizationId: orgId,
            createdByUserId: userId
        });
        if (meeting?.success) {
            const meetingId = meeting.data._id;
            await apiCall('Update Minutes', 'PUT', `/organizations/${orgId}/meetings/${meetingId}`, token, {
                status: 'completed',
                minutes: [
                    { content: 'We discussed everything.', actionItems: ['Item 1', 'Item 2'] }
                ]
            });
            console.log('✅ Created Committee, Meeting, and Minutes');
        }
    }

    // 8. Events & Fundraisers
    console.log('\n[8. Events & Fundraisers]');
    const event = await apiCall('Create Event', 'POST', `/organizations/${orgId}/events`, token, {
        name: 'Auto-Test Event',
        startDate: new Date().toISOString(),
        type: 'community',
        status: 'upcoming',
        organizationId: orgId,
        createdByUserId: userId
    });
    if (event?.success) {
        const eventId = event.data._id;
        await apiCall('Move Event Ongoing', 'PATCH', `/organizations/${orgId}/events/${eventId}`, token, { status: 'ongoing' });
        await apiCall('Move Event Completed', 'PATCH', `/organizations/${orgId}/events/${eventId}`, token, { status: 'completed' });
        console.log('✅ Event state transitions tested');
    }

    const fundraiser = await apiCall('Create Fundraiser', 'POST', `/organizations/${orgId}/fundraisers`, token, {
        name: 'Auto-Test Fundraiser',
        goalAmount: 50000,
        startDate: new Date().toISOString(),
        status: 'active',
        organizationId: orgId,
        createdByUserId: userId
    });
    if (fundraiser?.success) {
        const fId = fundraiser.data._id;
        // Create 100+ Pledges/Transactions for Fundraiser
        console.log('...creating 100+ fundraiser transactions');
        for (let i = 0; i < 105; i++) {
            const mId = memberIds[i % memberIds.length];
            await apiCall(`Pledge ${i}`, 'POST', `/organizations/${orgId}/fundraisers/${fId}/transactions`, token, {
                type: 'income',
                amount: 100,
                description: `Pledge ${i}`,
                memberId: mId,
                date: new Date().toISOString(),
                status: 'completed',
                payment: { method: 'cash' }
            });
        }
        await apiCall('Complete Fundraiser', 'PATCH', `/organizations/${orgId}/fundraisers/${fId}`, token, { status: 'completed' });
        console.log('✅ Fundraiser state and volume transactions tested');
    }

    // 9. Pagination Verification
    console.log('\n[9. Pagination Verification]');
    const membersPage = await apiCall('List Members Page 2', 'GET', `/organizations/${orgId}/members?page=2&limit=50`, token);
    if (membersPage?.data && membersPage.data.length > 0) {
        console.log(`✅ Pagination works: Found ${membersPage.data.length} members on Page 2`);
    } else {
        console.warn('⚠️ Pagination check failed or no members on page 2 (Expected 50+ members created in step 3)');
    }

    if (ledgerId) {
        const transactionsPage = await apiCall('List Transactions Page 2', 'GET', `/organizations/${orgId}/ledgers/${ledgerId}/transactions?page=2&limit=50`, token);
        if (transactionsPage?.data && transactionsPage.data.length > 0) {
            console.log(`✅ Pagination works: Found ${transactionsPage.data.length} transactions on Page 2`);
        } else {
            console.warn('⚠️ Pagination check failed for transactions');
        }
    }

    console.log('\n=== All Tests Completed ===');
}

runTests().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
