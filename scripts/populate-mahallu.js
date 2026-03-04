const API_KEY = 'AIzaSyBgBGuxZ3rTzFJMMmP2yl8_GAqZjQi2eo0';
const BASE_URL = 'http://localhost:5000/api';
// Connect via the newly created Org Admin
const EMAIL = 'mahallu@gmail.com';
const PASSWORD = '123456';

async function getAuthToken() {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(data));
        return data.idToken;
    } catch (error) {
        console.error('Auth failed:', error.message);
        process.exit(1);
    }
}

async function callApi(method, endpoint, token, body = null) {
    try {
        const options = {
            method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await response.json();
        if (!response.ok) {
            console.error(`❌ API Error on \${method} \${endpoint}:`, JSON.stringify(data, null, 2));
            return null;
        }
        return data;
    } catch (e) {
        console.error(`Fetch error on \${endpoint}:`, e);
        return null;
    }
}

async function populate() {
    console.log('Authenticating as Mahallu Admin...');
    const token = await getAuthToken();
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const orgId = payload.orgId;

    if (!orgId) {
        console.error('No Org ID in token. The user must belong to an organization.');
        return;
    }

    console.log(`Starting population for Organization ID: ${orgId}`);

    // Create 5 families
    const families = [
        { head: 'basheer', spouse: 'Fathima', children: ['Mohammed', 'Aisha', 'Umar', 'Khadija'] },
        { head: 'majeed', spouse: 'Zainab', children: ['Ali', 'Maryam', 'Hassan', 'Safiya'] },
        { head: 'kareem', spouse: 'Amina', children: ['Hussein', 'Rukayya', 'Ibrahim', 'Zahra'] },
        { head: 'rasal', spouse: 'Sumayya', children: ['Abdullah', 'Halima', 'Yusuf', 'Asma'] },
        { head: 'ziyad', spouse: 'Ruqayyah', children: ['Ismail', 'Hafsa', 'Sulaiman', 'Nusaybah'] }
    ];

    for (let i = 0; i < families.length; i++) {
        const family = families[i];
        const name = family.head;
        const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
        console.log(`\n--- Working on Household: ${capitalized} ---`);

        // 1. Create household + Head member + Auth User
        console.log(`Creating household, head member, and auth account for ${capitalized}...`);
        const householdRes = await callApi('POST', `/organizations/${orgId}/households`, token, {
            houseNumber: `MHL-${100 + i}`,
            addressLine1: 'Main Village',
            addressLine2: 'Ground Floor',
            houseName: `${capitalized} Residence`,
            primaryMobile: `980000000${i}`,
            email: `${name}@gmail.com`, // Creating Firebase auth user login
            password: '123456',
            headFullName: `${capitalized} Family`,
            headGender: 'male',
            headMaritalStatus: 'married'
        });

        if (householdRes && householdRes.success) {
            const householdId = householdRes.data.household._id;
            const headMemberId = householdRes.data.headMember._id;
            console.log(`✅ Created Household ID: ${householdId}`);

            // 2. Create spouse
            console.log(`Linking Spouse to Household...`);
            const spouseRes = await callApi('POST', `/organizations/${orgId}/members`, token, {
                fullName: `${family.spouse} ${capitalized}`,
                dateOfBirth: '1985-05-05',
                gender: 'female',
                currentHouseholdId: householdId,
                maritalStatus: 'married',
                spouseId: headMemberId
            });
            let motherId = null;
            if (spouseRes && spouseRes.success) {
                console.log(`✅ Added Spouse ID: ${spouseRes.data._id}`);
                motherId = spouseRes.data._id;
            }

            // 3. Create 4 children
            console.log(`Linking 4 Children to Household...`);
            for (let j = 0; j < 4; j++) {
                const childPayload = {
                    fullName: `${family.children[j]} ${capitalized}`,
                    dateOfBirth: `201${j + 1}-01-01`,
                    gender: j % 2 !== 0 ? 'female' : 'male',
                    currentHouseholdId: householdId,
                    maritalStatus: 'single',
                    fatherId: headMemberId
                };

                // Add mother reference if spouse successfully created
                if (motherId) {
                    childPayload.motherId = motherId;
                }

                const childRes = await callApi('POST', `/organizations/${orgId}/members`, token, childPayload);
                if (childRes && childRes.success) {
                    console.log(`✅ Added Child ${j + 1} ID: ${childRes.data._id}`);
                }
            }
        } else {
            console.log(`❌ Failed to create household for ${capitalized}`);
        }
    }
    console.log('\nPopulation complete!');
}

populate();
