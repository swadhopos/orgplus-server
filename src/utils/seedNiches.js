const OrgNicheType = require('../models/OrgNicheType');

const nicheTypes = [
  {
    name: 'Religious & Faith Communities',
    key: 'religious',
    description: 'Mahallus, Churches, Temples, Mosques, Synagogues',
    membershipModel: 'group_required',
    labels: { groupLabel: 'Family', memberLabel: 'Member' },
    features: {
      hasMembers: true,
      hasGroups: true,
      hasEvents: true,
      hasCommittees: true,
      hasBMD: true,
      hasSubscriptions: false,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true,
      hasCertificates: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'Mahallu', key: 'mahallu' },
      { label: 'Mosque', key: 'mosque' },
      { label: 'Church', key: 'church' },
      { label: 'Temple', key: 'temple' },
      { label: 'Synagogue', key: 'synagogue' },
      { label: 'Gurudwara', key: 'gurudwara' },
      { label: 'Buddhist Vihara', key: 'buddhist_vihara' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#10b981', '#1e3a8a', '#d4af37', '#991b1b', '#7c3aed', '#4338ca', '#065f46']
  },
  {
    name: 'Residential Communities',
    key: 'hoa',
    description: 'Homeowners Associations, Resident Welfare Associations, Apartments',
    membershipModel: 'group_required',
    labels: { groupLabel: 'Unit', memberLabel: 'Resident' },
    features: {
      hasMembers: true,
      hasGroups: true,
      hasEvents: true,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: true,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'Apartment Complex', key: 'apartment' },
      { label: 'Gated Community', key: 'gated' },
      { label: 'Housing Society', key: 'rwa' },
      { label: 'Plotted Colony', key: 'plotted' },
      { label: 'Villa Community', key: 'villa' },
      { label: 'Township', key: 'township' },
      { label: 'Row Houses', key: 'row_houses' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#c2410c', '#4d7c0f', '#475569', '#1e3a8a', '#991b1b', '#0369a1', '#57534e']
  },
  {
    name: 'Shop Owners Association',
    key: 'shop_association',
    description: 'Trader federations, market associations',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Shop', memberLabel: 'Owner' },
    features: {
      hasMembers: true,
      hasGroups: true,
      hasEvents: true,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: true,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'Market Association', key: 'market' },
      { label: 'Trader Federation', key: 'trader' },
      { label: 'Mall Vendor Group', key: 'mall' },
      { label: 'Street Vendors Union', key: 'street_vendor' },
      { label: 'Industrial Estate Assoc.', key: 'industrial' },
      { label: 'Wholesale Market Assoc.', key: 'wholesale' },
      { label: 'E-Commerce Sellers', key: 'ecommerce' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#1e40af', '#475569', '#14532d', '#b91c1c', '#ea580c', '#334155', '#2563eb']
  },
  {
    name: 'Political & Grassroots',
    key: 'political',
    description: 'Local party chapters, community advocacy groups',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Ward', memberLabel: 'Worker' },
    features: {
      hasMembers: true,
      hasGroups: true,
      hasEvents: true,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: false,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'Local Party Chapter', key: 'local_party' },
      { label: 'Ward Committee', key: 'ward' },
      { label: 'Constituency Group', key: 'constituency' },
      { label: 'Advocacy Group', key: 'advocacy' },
      { label: 'Residents Action Group', key: 'residents_action' },
      { label: 'Youth Wing', key: 'youth' },
      { label: 'Women\'s Wing', key: 'women' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#1e3a8a', '#b91c1c', '#166534', '#581c87', '#ea580c', '#334155', '#dc2626']
  },
  {
    name: 'Social & Recreational Clubs',
    key: 'club',
    description: 'Rotary, Lions, Sports, Country Clubs',
    membershipModel: 'individual_only',
    labels: { groupLabel: null, memberLabel: 'Member' },
    features: {
      hasMembers: true,
      hasGroups: false,
      hasEvents: true,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: true,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'Sports Club', key: 'sports' },
      { label: 'Rotary Club', key: 'rotary' },
      { label: 'Lions Club', key: 'lions' },
      { label: 'Country Club', key: 'country' },
      { label: 'Cultural Club', key: 'cultural' },
      { label: 'Recreation Club', key: 'recreation' },
      { label: 'Nature Club', key: 'nature' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#3b82f6', '#f472b6', '#a855f7', '#22d3ee', '#fb923c', '#ef4444', '#10b981']
  },
  {
    name: 'Professional Associations',
    key: 'professional_association',
    description: 'Medical, Bar, Teachers Associations, Chambers of Commerce',
    membershipModel: 'individual_only',
    labels: { groupLabel: null, memberLabel: 'Member' },
    features: {
      hasMembers: true,
      hasGroups: false,
      hasEvents: true,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: true,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: true },
    subtypes: [
      { label: 'Medical Association', key: 'medical' },
      { label: 'Bar Association', key: 'bar' },
      { label: 'Teachers Association', key: 'teachers' },
      { label: 'Chamber of Commerce', key: 'chamber' },
      { label: 'Engineers Guild', key: 'engineers' },
      { label: 'Architects Guild', key: 'architects' },
      { label: 'CAs Association', key: 'ca' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#1e40af', '#475569', '#14532d', '#7f1d1d', '#1e3a8a', '#2563eb', '#374151']
  },
  {
    name: 'Non-Profits & NGOs',
    key: 'ngo',
    description: 'Local charities, relief orgs, environmental groups',
    membershipModel: 'individual_only',
    labels: { groupLabel: null, memberLabel: 'Volunteer' },
    features: {
      hasMembers: true,
      hasGroups: false,
      hasEvents: true,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: false,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: true },
    subtypes: [
      { label: 'Charity Organization', key: 'charity' },
      { label: 'Relief Organization', key: 'relief' },
      { label: 'Environmental Group', key: 'environmental' },
      { label: 'Education NGO', key: 'education' },
      { label: 'Health NGO', key: 'health' },
      { label: 'Women Empowerment NGO', key: 'women_empowerment' },
      { label: 'Child Welfare NGO', key: 'child_welfare' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#f97316', '#0ea5e9', '#e11d48', '#16a34a', '#0d9488', '#8b5cf6', '#f59e0b']
  },
  {
    name: 'Alumni Networks & PTAs',
    key: 'alumni',
    description: 'College/School Alumni Associations, Parent-Teacher Associations',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Batch', memberLabel: 'Alumni' },
    features: {
      hasMembers: true,
      hasGroups: true,
      hasEvents: true,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: false,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'College Alumni', key: 'college' },
      { label: 'School Alumni', key: 'school' },
      { label: 'Parent-Teacher Association', key: 'pta' },
      { label: 'Batch Group', key: 'batch' },
      { label: 'University Alumni', key: 'university' },
      { label: 'Management Alumni', key: 'management' },
      { label: 'Department Alumni', key: 'department' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#991b1b', '#172554', '#064e3b', '#ca8a04', '#2563eb', '#450a0a', '#1e40af']
  },
  {
    name: 'Cooperative Society',
    key: 'cooperative',
    description: 'Farmer co-ops, Credit societies',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Department', memberLabel: 'Member' },
    features: {
      hasMembers: true,
      hasGroups: true,
      hasEvents: false,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: true,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'Farmer Cooperative', key: 'farmer' },
      { label: 'Credit Society', key: 'credit' },
      { label: 'Consumer Co-op', key: 'consumer' },
      { label: 'Housing Co-op', key: 'housing' },
      { label: 'Dairy Cooperative', key: 'dairy' },
      { label: 'Fishery Cooperative', key: 'fishery' },
      { label: 'Handicraft Co-op', key: 'handicraft' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#15803d', '#1e40af', '#ea580c', '#0f766e', '#78350f', '#0369a1', '#14532d']
  },
  {
    name: 'Trade Union / Labour Union',
    key: 'trade_union',
    description: 'Labour unions, worker federations',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Unit', memberLabel: 'Worker' },
    features: {
      hasMembers: true,
      hasGroups: true,
      hasEvents: false,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: false,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'Labour Union', key: 'labour' },
      { label: 'Transport Workers Union', key: 'transport' },
      { label: 'Construction Workers Union', key: 'construction' },
      { label: 'Domestic Workers Union', key: 'domestic' },
      { label: 'Textile Workers Union', key: 'textile' },
      { label: 'Bank Employees Union', key: 'bank' },
      { label: 'Teachers Union', key: 'teachers' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#dc2626', '#1d4ed8', '#4b5563', '#fb8c00', '#064e3b', '#374151', '#991b1b']
  },
  {
    name: 'Cultural & Community Assoc.',
    key: 'cultural_association',
    description: 'Diaspora, Community associations',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Unit', memberLabel: 'Member' },
    features: {
      hasMembers: true,
      hasGroups: true,
      hasEvents: true,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: false,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'Diaspora Association', key: 'diaspora' },
      { label: 'Regional Community', key: 'regional' },
      { label: 'Language Community', key: 'language' },
      { label: 'Folk Arts Group', key: 'folk_arts' },
      { label: 'Religious Cultural Group', key: 'religious' },
      { label: 'Tribal Community', key: 'tribal' },
      { label: 'Expatriate Community', key: 'expat' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#db2777', '#7e22ce', '#fbbf24', '#b91c1c', '#06b6d4', '#111827', '#4338ca']
  },
  {
    name: 'Women\'s SHG',
    key: 'shg',
    description: 'Self-Help Groups',
    membershipModel: 'individual_only',
    labels: { groupLabel: null, memberLabel: 'Member' },
    features: {
      hasMembers: true,
      hasGroups: false,
      hasEvents: false,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: true,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'Women\'s SHG', key: 'women' },
      { label: 'Youth SHG', key: 'youth' },
      { label: 'Farmers SHG', key: 'farmers' },
      { label: 'Artisans SHG', key: 'artisans' },
      { label: 'Fisherwomen SHG', key: 'fisherwomen' },
      { label: 'Tribal SHG', key: 'tribal' },
      { label: 'Urban Poor SHG', key: 'urban_poor' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#f472b6', '#c084fc', '#2dd4bf', '#fb923c', '#34d399', '#f06292', '#8b5cf6']
  },
  {
    name: 'Student Union / Youth Org',
    key: 'student_union',
    description: 'Student federations, youth clubs',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Campus', memberLabel: 'Student' },
    features: {
      hasMembers: true,
      hasGroups: true,
      hasEvents: false,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: false,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Voluntary_AdHoc', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'Student Federation', key: 'federation' },
      { label: 'Youth Club', key: 'youth_club' },
      { label: 'Campus Committee', key: 'campus' },
      { label: 'College Council', key: 'college_council' },
      { label: 'School Cabinet', key: 'school_cabinet' },
      { label: 'Debate Society', key: 'debate' },
      { label: 'Technical Club', key: 'technical' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#0ea5e9', '#a855f7', '#34d399', '#6366f1', '#fb923c', '#ef4444', '#f59e0b']
  },
  {
    name: 'Farmers FPO',
    key: 'farmers_fpo',
    description: 'Farmer Producer Organizations',
    membershipModel: 'group_optional',
    labels: { groupLabel: 'Cluster', memberLabel: 'Farmer' },
    features: {
      hasMembers: true,
      hasGroups: true,
      hasEvents: false,
      hasCommittees: true,
      hasBMD: false,
      hasSubscriptions: true,
      hasNotices: true,
      hasLedger: true,
      hasStaff: true
    },
    financial: { paymentType: 'Mandatory_Recurring', canIssueTaxExemptions: false },
    subtypes: [
      { label: 'Farmer Producer Org', key: 'fpo' },
      { label: 'Agri Cluster', key: 'cluster' },
      { label: 'Horticulture FPO', key: 'horticulture' },
      { label: 'Dairy FPO', key: 'dairy' },
      { label: 'Spices FPO', key: 'spices' },
      { label: 'Fisheries FPO', key: 'fisheries' },
      { label: 'Organic Farmers FPO', key: 'organic' },
      { label: 'Other', key: 'other' }
    ],
    suggestedColors: ['#065f46', '#15803d', '#0f766e', '#78350f', '#65a30d', '#1e40af', '#ea580c']
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
    console.log('Niche types seeded successfully with suggested colors');
  } catch (error) {
    console.error('Error seeding niche types:', error);
  }
};

module.exports = seedNiches;
