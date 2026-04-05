const API_KEY = 'AIzaSyBgBGuxZ3rTzFJMMmP2yl8_GAqZjQi2eo0';
const BASE_URL = 'http://localhost:5000/api';
// Using the working test admin to authenticate the staff session
const ADMIN_EMAIL = 'northside.admin1932@gmail.com';
const ADMIN_PASSWORD = 'Admin@123456';

// The credentials the user wants to test as the NEW HEAD
const NEW_HEAD_EMAIL = 'citu@google.com';
const NEW_HEAD_PASS = '12345678';

async function getAuthToken() {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                returnSecureToken: true
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(JSON.stringify(data));
        }
        return data.idToken;
    } catch (error) {
        console.error('Authentication failed:', error.message);
        process.exit(1);
    }
}

async function runSurveyTest() {
    const token = await getAuthToken();
    const orgId = '69b7ca290120a39d767fa17c';
    
    console.log(`\n🚀 Testing Group Survey Endpoint for Org: ${orgId}`);
    
    const payload = {
        household: {
            houseName: "Greenwood Villa",
            houseNumber: "GV-999",
            addressLine1: "123 Orchard Lane",
            addressLine2: "North Sector",
            postalCode: "560001",
            primaryMobile: "9000000000",
            financialStatus: "APL",
            status: "active"
        },
        members: [
            {
                fullName: "Alice Greenwood",
                gender: "female",
                dateOfBirth: "1985-05-20",
                maritalStatus: "married",
                isHead: true,
                mobileNumber: "9111111111",
                email: "alice@example.com",
                occupation: "Architect",
                isWorkingAbroad: false,
                medicalInfo: {
                    bloodGroup: "A+",
                    allergies: ["Peanuts"],
                    medications: ["None"],
                    specialNeeds: "None"
                },
                status: "active"
            },
            {
                fullName: "Bob Greenwood",
                gender: "male",
                dateOfBirth: "1982-11-10",
                maritalStatus: "married",
                isHead: false,
                mobileNumber: "9222222222",
                occupation: "Developer",
                isWorkingAbroad: true,
                abroadCountry: "Germany",
                medicalInfo: {
                    bloodGroup: "B-",
                    allergies: [],
                    medications: [],
                    specialNeeds: ""
                },
                status: "active"
            }
        ],
        email: NEW_HEAD_EMAIL,
        password: NEW_HEAD_PASS
    };

    try {
        const response = await fetch(`${BASE_URL}/organizations/${orgId}/households/survey`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ SURVEY SUCCESS!');
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('❌ SURVEY FAILED');
            console.log('Status:', response.status);
            console.log('Error:', JSON.stringify(result, null, 2));
        }
    } catch (error) {
        console.error('Network Error:', error.message);
    }
}

runSurveyTest();
