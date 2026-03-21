const OrgNicheType = require('../models/OrgNicheType');

const nicheTypes = [
  {
    name: 'Religious & Faith Communities',
    key: 'religious',
    description: 'Mahallus, Churches, Temples, Mosques, Synagogues',
    membershipModel: 'group_required',
    labels: { groupLabel: 'Family', memberLabel: 'Member' },
    features: {
      hasGroups: true,
      hasCommittees: true,
      hasSponsorships: true,
      hasNOCIssuance: true,
      hasEventRSVP: false,
      hasBroadcast: true,
      hasMarriageCertificate: true,
      hasMarriageNOC: true,
      hasDeathRegister: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: false }
  },
  {
    name: 'Residential Communities',
    key: 'hoa',
    description: 'Homeowners Associations, Resident Welfare Associations, Apartments',
    membershipModel: 'group_required',
    labels: { groupLabel: 'Unit', memberLabel: 'Resident' },
    features: {
      hasGroups: true,
      hasCommittees: true,
      hasSponsorships: false,
      hasNOCIssuance: false,
      hasEventRSVP: true,
      hasBroadcast: true,
      hasDuesAutoGeneration: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false }
  },
  {
    name: 'Shop Owners Association',
    key: 'shop_association',
    description: 'Trader federations, market associations',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Shop', memberLabel: 'Owner' },
    features: {
      hasGroups: true,
      hasCommittees: true,
      hasSponsorships: true,
      hasEventRSVP: false,
      hasBroadcast: true,
      hasMembershipExpiry: true,
      hasDuesAutoGeneration: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false }
  },
  {
    name: 'Political & Grassroots',
    key: 'political',
    description: 'Local party chapters, community advocacy groups',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Ward', memberLabel: 'Worker' },
    features: {
      hasGroups: true,
      hasCommittees: true,
      hasSponsorships: false,
      hasEventRSVP: true,
      hasBroadcast: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: false }
  },
  {
    name: 'Social & Recreational Clubs',
    key: 'club',
    description: 'Rotary, Lions, Sports, Country Clubs',
    membershipModel: 'individual_only',
    labels: { groupLabel: null, memberLabel: 'Member' },
    features: {
      hasGroups: false,
      hasCommittees: true,
      hasSponsorships: true,
      hasEventRSVP: true,
      hasBroadcast: true,
      hasMembershipExpiry: true,
      hasDuesAutoGeneration: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false }
  },
  {
    name: 'Professional Associations',
    key: 'professional_association',
    description: 'Medical, Bar, Teachers Associations, Chambers of Commerce',
    membershipModel: 'individual_only',
    labels: { groupLabel: null, memberLabel: 'Member' },
    features: {
      hasGroups: false,
      hasCommittees: true,
      hasSponsorships: false,
      hasNOCIssuance: true,
      hasEventRSVP: true,
      hasBroadcast: true,
      hasMembershipExpiry: true,
      hasDuesAutoGeneration: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: true }
  },
  {
    name: 'Non-Profits & NGOs',
    key: 'ngo',
    description: 'Local charities, relief orgs, environmental groups',
    membershipModel: 'individual_only',
    labels: { groupLabel: null, memberLabel: 'Volunteer' },
    features: {
      hasGroups: false,
      hasCommittees: true,
      hasSponsorships: true,
      hasEventRSVP: true,
      hasBroadcast: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: true }
  },
  {
    name: 'Alumni Networks & PTAs',
    key: 'alumni',
    description: 'College/School Alumni Associations, Parent-Teacher Associations',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Batch', memberLabel: 'Alumni' },
    features: {
      hasGroups: true,
      hasCommittees: true,
      hasSponsorships: true,
      hasEventRSVP: true,
      hasBroadcast: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: false }
  },
  {
    name: 'Cooperative Society',
    key: 'cooperative',
    description: 'Farmer co-ops, Credit societies',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Department', memberLabel: 'Member' },
    features: {
      hasGroups: true,
      hasCommittees: true,
      hasBroadcast: true,
      hasDuesAutoGeneration: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false }
  },
  {
    name: 'Trade Union / Labour Union',
    key: 'trade_union',
    description: 'Labour unions, worker federations',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Unit', memberLabel: 'Worker' },
    features: {
      hasGroups: true,
      hasCommittees: true,
      hasBroadcast: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false }
  },
  {
    name: 'Cultural & Community Assoc.',
    key: 'cultural_association',
    description: 'Diaspora, Community associations',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Unit', memberLabel: 'Member' },
    features: {
      hasGroups: true,
      hasCommittees: true,
      hasSponsorships: true,
      hasBroadcast: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: false }
  },
  {
    name: 'Women\'s SHG',
    key: 'shg',
    description: 'Self-Help Groups',
    membershipModel: 'individual_only',
    labels: { groupLabel: null, memberLabel: 'Member' },
    features: {
      hasGroups: false,
      hasCommittees: true,
      hasBroadcast: true,
      hasDuesAutoGeneration: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false }
  },
  {
    name: 'Student Union / Youth Org',
    key: 'student_union',
    description: 'Student federations, youth clubs',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Campus', memberLabel: 'Student' },
    features: {
      hasGroups: true,
      hasCommittees: true,
      hasBroadcast: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: false }
  },
  {
    name: 'Farmers FPO',
    key: 'farmers_fpo',
    description: 'Farmer Producer Organizations',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Cluster', memberLabel: 'Farmer' },
    features: {
      hasGroups: true,
      hasCommittees: true,
      hasBroadcast: true,
      hasDuesAutoGeneration: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false }
  }
];

const seedNiches = async () => {
  try {
    for (const niche of nicheTypes) {
      await OrgNicheType.findOneAndUpdate(
        { key: niche.key },
        niche,
        { upsert: true, new: true }
      );
    }
    console.log('Niche types seeded successfully');
  } catch (error) {
    console.error('Error seeding niche types:', error);
  }
};

module.exports = seedNiches;
