const API_KEY = 'AIzaSyBgBGuxZ3rTzFJMMmP2yl8_GAqZjQi2eo0';
const BASE_URL = 'http://localhost:5000/api';

async function bootstrap() {
    try {
        const response = await fetch(`${BASE_URL}/auth/bootstrap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        console.log('Bootstrap Response:', data);
    } catch (e) {
        console.error('Bootstrap failed:', e);
    }
}

async function getAuthToken() {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                email: 'nksuhail13@gmail.com',
                password: 'ChangeThisPassword123!',
                returnSecureToken: true
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(data));
        console.log('Successfully authenticated as systemAdmin');
        return data.idToken;
    } catch (error) {
        console.error('Authentication failed:', error.message);
        process.exit(1);
    }
}

async function createOrg() {
    await bootstrap();
    const token = await getAuthToken();

    console.log('Connecting to MongoDB to clean up old Mahallu Organization...');
    const mongoose = require('mongoose');
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus');
    const db = mongoose.connection.db;

    try {
        const existingOrgResult = await db.collection('organizations').findOneAndUpdate(
            { name: 'Mahallu Organization' },
            { $set: { name: `Mahallu Organization_deleted_${Date.now()}` } }
        );
        if (existingOrgResult) {
            console.log(`Renamed old "Mahallu Organization" to avoid name collision.`);
        } else {
            console.log('No existing "Mahallu Organization" found to rename.');
        }
    } catch (e) {
        console.log('Error or no existing org found:', e.message);
    }

    console.log('Creating Mahallu Organization...');
    const response = await fetch(`${BASE_URL}/organizations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: 'Mahallu Organization',
            type: 'mahallu',
            address: 'Mahallu Demo Address',
            contactEmail: 'mahallu@gmail.com',
            contactPhone: '9999999999',
            adminEmail: 'mahallu@gmail.com',
            adminPassword: '123456',
            status: 'active'
        })
    });

    const data = await response.json();
    if (!response.ok) {
        console.error('Failed to create organization:', JSON.stringify(data, null, 2));
    } else {
        console.log('Successfully created organization:');
        console.log(JSON.stringify(data, null, 2));
    }
}

createOrg();
