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
        if (!response.ok) throw new Error(JSON.stringify(data));
        console.log('Successfully authenticated');
        return data.idToken;
    } catch (error) {
        console.error('Authentication failed:', error.message);
        process.exit(1);
    }
}

async function callApi(method, endpoint, token, body = null) {
    try {
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        if (body) options.body = JSON.stringify(body);
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await response.json();
        if (!response.ok) {
            console.error(`Error on ${method} ${endpoint}:`, JSON.stringify(data, null, 2));
            return null;
        }
        return data;
    } catch (error) {
        console.error(`Fetch error on ${endpoint}:`, error.message);
        return null;
    }
}

async function populate() {
    const token = await getAuthToken();
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const orgId = payload.orgId;

    if (!orgId) {
        console.error('No Org ID found in token. Make sure the user is an admin for an organization.');
        return;
    }

    console.log(`Populating Org: ${orgId}`);

    const surnames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'];
    const genders = ['male', 'female'];

    for (let i = 0; i < 5; i++) {
        const surname = surnames[i];
        console.log(`\n--- Creating Household ${i + 1}: ${surname} Family ---`);

        // 1. Create Household (includes Head Member)
        const householdRes = await callApi('POST', `/organizations/${orgId}/households`, token, {
            houseNumber: `${100 + i}`,
            block: 'A',
            floor: `${i + 1}`,
            ownerName: `Mr. ${surname}`,
            contactPhone: `999000000${i}`,
            firstName: 'Ahmad', // Head Name
            lastName: surname,
            dateOfBirth: '1975-05-15',
            gender: 'male',
            occupancyStatus: 'owner-occupied'
        });

        if (householdRes && householdRes.success) {
            const householdId = householdRes.data.household._id;
            console.log(`Created Household: ${householdId}`);

            // 2. Create 4 Children
            for (let j = 1; j <= 4; j++) {
                const childGender = genders[j % 2];
                const childRes = await callApi('POST', `/organizations/${orgId}/members`, token, {
                    firstName: `Child${j}`,
                    lastName: surname,
                    dateOfBirth: `201${j}-01-01`,
                    gender: childGender,
                    householdId: householdId,
                    relationshipType: 'child',
                    organizationId: orgId
                });
                if (childRes && childRes.success) {
                    console.log(`  - Added Child ${j}: ${childRes.data._id}`);
                }
            }
        }
    }

    console.log('\nPopulation Complete!');
}

populate();
