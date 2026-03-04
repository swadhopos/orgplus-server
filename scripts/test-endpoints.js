const API_KEY = 'AIzaSyBgBGuxZ3rTzFJMMmP2yl8_GAqZjQi2eo0';
const BASE_URL = 'http://localhost:5000/api';
const EMAIL = 'northside.admin1932@gmail.com';
const PASSWORD = 'Admin@123456';

async function getAuthToken() {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                email: EMAIL,
                password: PASSWORD,
                returnSecureToken: true
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(JSON.stringify(data));
        }
        console.log('Successfully authenticated');
        return data.idToken;
    } catch (error) {
        console.error('Authentication failed:', error.message);
        process.exit(1);
    }
}

async function testEndpoint(name, method, endpoint, token, body = null) {
    process.stdout.write(`Testing ${name} (${method} ${endpoint})... `);
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
            console.log('✅ PASS (Status: ' + response.status + ')');
            return data;
        } else {
            console.log('❌ FAIL (Status: ' + response.status + ')');
            console.log('   Error:', JSON.stringify(data, null, 2));
            return null;
        }
    } catch (error) {
        console.log('❌ FAIL (Error: ' + error.message + ')');
        return null;
    }
}

async function runTests() {
    const token = await getAuthToken();
    if (!token) return;

    console.log('\n--- Organization Portal CRUD Tests ---');

    // 1. Organizations
    console.log('\n[1. Organizations]');
    const orgs = await testEndpoint('List Organizations', 'GET', '/organizations', token);
    let orgId;

    if (orgs && orgs.data && orgs.data.length > 0) {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        const myOrg = orgs.data.find(o => o._id === payload.orgId) || orgs.data[0];
        orgId = myOrg._id;
        console.log(`Using Org ID: ${orgId}`);
    } else {
        console.log('⚠️ No organizations found.');
    }

    if (orgId) {
        await testEndpoint('Get Organization', 'GET', `/organizations/${orgId}`, token);
        await testEndpoint('Update Organization', 'PUT', `/organizations/${orgId}`, token, {
            description: 'Updated description for testing'
        });
    }

    // 2. Households & Member Coupling
    console.log('\n[2. Households & Member Coupling]');
    let householdId;
    let headMemberId;
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const householdRes = await testEndpoint('Create Household + Head Member', 'POST', `/organizations/${orgId}/households`, token, {
        houseNumber: `H-${Date.now()}`,
        ownerName: 'Test Owner',
        contactPhone: '9876543210',
        organizationId: orgId,
        createdByUserId: payload.uid,
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1980-01-01',
        gender: 'male'
    });

    if (householdRes && householdRes.success && householdRes.data && householdRes.data.household) {
        householdId = householdRes.data.household._id;
        headMemberId = householdRes.data.headMember._id;
        console.log(`Created Household: ${householdId}, Head Member: ${headMemberId}`);

        await testEndpoint('List Households', 'GET', `/organizations/${orgId}/households`, token);
        await testEndpoint('Get Household', 'GET', `/organizations/${orgId}/households/${householdId}`, token);

        // List members by household
        const membersReq = await testEndpoint('List Members by Household', 'GET', `/organizations/${orgId}/members?householdId=${householdId}`, token);
        const hasHead = membersReq && membersReq.data && membersReq.data.some(m => m._id === headMemberId);
        console.log(`Head Member found in household list: ${hasHead ? '✅ YES' : '❌ NO'}`);

        // Create a spouse member
        const spouse = await testEndpoint('Create Spouse Member', 'POST', `/organizations/${orgId}/members`, token, {
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: '1982-05-15',
            gender: 'female',
            householdId: householdId,
            relationshipType: 'spouse',
            spouseId: headMemberId,
            organizationId: orgId
        });

        if (spouse && spouse.data) {
            await testEndpoint('Delete Spouse Member', 'DELETE', `/organizations/${orgId}/members/${spouse.data._id}`, token);
        }
        await testEndpoint('Delete Head Member', 'DELETE', `/organizations/${orgId}/members/${headMemberId}`, token);
    } else {
        console.log('⚠️ Failed to create household. Check server logs.');
    }

    // 3. Committees
    console.log('\n[3. Committees]');
    const committee = await testEndpoint('Create Committee', 'POST', `/organizations/${orgId}/committees`, token, {
        name: `Test Committee ${Date.now()}`,
        type: 'sports',
        organizationId: orgId,
        createdByUserId: 'system-test'
    });
    if (committee) {
        const committeeId = committee.data._id;
        await testEndpoint('List Committees', 'GET', `/organizations/${orgId}/committees`, token);
        await testEndpoint('Get Committee', 'GET', `/organizations/${orgId}/committees/${committeeId}`, token);
        await testEndpoint('Update Committee', 'PUT', `/organizations/${orgId}/committees/${committeeId}`, token, {
            description: 'Updated committee description'
        });

        // 4. Meetings
        console.log('\n[4. Meetings]');
        const meeting = await testEndpoint('Create Meeting', 'POST', `/organizations/${orgId}/committees/${committeeId}/meetings`, token, {
            committeeId: committeeId,
            meetingDate: new Date(Date.now() + 86400000).toISOString(),
            location: 'Test Conference Room',
            agenda: 'Test Agenda',
            organizationId: orgId,
            createdByUserId: 'system-test'
        });
        if (meeting) {
            const meetingId = meeting.data._id;
            await testEndpoint('List Meetings', 'GET', `/organizations/${orgId}/committees/${committeeId}/meetings`, token);
            await testEndpoint('Get Meeting', 'GET', `/organizations/${orgId}/committees/${committeeId}/meetings/${meetingId}`, token);
            await testEndpoint('Update Meeting', 'PUT', `/organizations/${orgId}/committees/${committeeId}/meetings/${meetingId}`, token, {
                location: 'Updated Conference Room'
            });
            await testEndpoint('Delete Meeting', 'DELETE', `/organizations/${orgId}/committees/${committeeId}/meetings/${meetingId}`, token);
        }
        await testEndpoint('Delete Committee', 'DELETE', `/organizations/${orgId}/committees/${committeeId}`, token);
    }

    // 5. Members (General List)
    console.log('\n[5. Members List]');
    await testEndpoint('List Members', 'GET', `/organizations/${orgId}/members`, token);
}

runTests();
