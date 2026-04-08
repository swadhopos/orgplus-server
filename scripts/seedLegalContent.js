require('dotenv').config();
const mongoose = require('mongoose');
const LegalContent = require('../src/models/LegalContent');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orgplus';

const boilerplateContent = [
  {
    type: 'tos',
    title: 'Terms of Service',
    content: `
# Terms of Service
Last Updated: April 2024

Welcome to OrgPlus. By using our platform, you agree to these terms.

## 1. Membership & Access
* You must be a registered member of your organization to access this PWA.
* You are responsible for maintaining the confidentiality of your account credentials.

## 2. Payments & Contributions
* Online payments made through the platform are processed using secure third-party gateways.
* All contributions and fees are subject to the organization's refund policies.

## 3. Communication
* By registering, you consent to receive push notifications and alerts regarding organization activities.

## 4. Limitation of Liability
* OrgPlus provides a platform for organization management and is not liable for internal organization disputes.
    `,
    organizationId: null
  },
  {
    type: 'privacy',
    title: 'Privacy Policy',
    content: `
# Privacy Policy
Last Updated: April 2024

Your privacy is important to us. This policy explains how we handle your data.

## 1. Information Collection
* We collect personal details like name, contact info, and household details as provided by you or your organization.

## 2. Usage of Information
* Data is used solely for organization management, communication, and processing payments.
* We do not sell your personal information to third parties.

## 3. Data Security
* We implement industry-standard security measures, including encryption via Firebase Authentication.

## 4. Your Rights
* You can view and update your profile information directly through the PWA.
    `,
    organizationId: null
  },
  {
    type: 'faq',
    title: 'How do I pay my dues?',
    content: 'Navigate to the Payments tab, select your pending dues, and click on Pay Now. You can pay via UPI or other available methods.',
    organizationId: null
  },
  {
    type: 'faq',
    title: 'Where can I see my payment history?',
    content: 'Go to the Payments tab and click on the "History" button at the top right to see all your past transactions.',
    organizationId: null
  },
  {
    type: 'faq',
    title: 'How do I update my household details?',
    content: 'On the Profile page, click on your Household name. If you are the head of the household, you will see an option to edit details.',
    organizationId: null
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing global defaults
    await LegalContent.deleteMany({ organizationId: null });
    console.log('Cleared existing global legal content');

    // Insert boilerplate
    await LegalContent.insertMany(boilerplateContent);
    console.log('Seeded boilerplate legal content successfully');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seed();
