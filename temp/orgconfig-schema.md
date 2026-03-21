# OrgConfig Schema — Per Niche Definitions

The `orgConfig` is set once during org creation in the Admin Panel and is **never editable after.**

---

## The Three Membership Models

| `membershipModel`  | Meaning | Who decides? |
|--------------------|---------|--------------|
| `group_required`   | Every member must belong to a group. No standalone members. | The org type forces this. |
| `group_optional`   | Groups exist, but members can also be standalone (no group). | The org admin configures this per their preference. |
| `individual_only`  | No groups at all. Flat member list only. | The org type forces this. |

---

## Full Config Schema

```json
{
  "membershipModel": "group_required | group_optional | individual_only",
  "groupLabel": "Family",          // Only used in group_required and group_optional models
  "memberLabel": "Member",         // What an individual is called
  "leaderLabel": "President",      // Head of the org / committee head
  "donationLabel": "Donation",     // What payments are called
  "committeeLabel": "Committee",   // What a committee is called

  "features": {
    "hasGroups": true,             // true if group_required or group_optional; false if individual_only
    "hasCommittees": true,
    "hasSponsorships": true,
    "hasNOCIssuance": false,
    "hasEventRSVP": false,
    "hasBroadcast": false,
    "hasMembershipExpiry": false,     // Whether membership can expire (validUntil date)
    "hasDuesAutoGeneration": false    // Auto-generate payment dues on a schedule
  },

  "financial": {
    "paymentType": "Voluntary_AdHoc | Mandatory_Recurring",
    "currency": "INR",
    "canIssueTaxExemptions": false
  },

  "idFormat": {
    "orgCode": "AA",
    "format": "group_member | member_only"
    // group_member  =>  AA-1-3  (Org → Group → Member)
    // member_only   =>  AA-7    (Org → Member)
  }
}
```

---

## Per-Niche Config Templates

### 1. Religious & Faith Communities
*Mahallu, Church, Temple, Mosque*
> Groups (families) are **mandatory**. Every member must belong to a family.

```json
{
  "membershipModel": "group_required",
  "groupLabel": "Family",
  "memberLabel": "Member",
  "leaderLabel": "Secretary",
  "donationLabel": "Donation",
  "committeeLabel": "Committee",
  "features": {
    "hasGroups": true,
    "hasCommittees": true,
    "hasSponsorships": true,
    "hasNOCIssuance": true,
    "hasEventRSVP": false,
    "hasBroadcast": true,
    "hasMembershipExpiry": false,
    "hasDuesAutoGeneration": false
  },
  "financial": { "paymentType": "Voluntary_AdHoc", "currency": "INR", "canIssueTaxExemptions": false },
  "idFormat": { "format": "group_member" }
}
```

---

### 2. Residential Communities (HOA / RWA / Apartments)
*Homeowners Associations, Resident Welfare Associations*
> Groups (units/flats) are **mandatory**. A resident must belong to a unit.

```json
{
  "membershipModel": "group_required",
  "groupLabel": "Unit",
  "memberLabel": "Resident",
  "leaderLabel": "President",
  "donationLabel": "Maintenance Fee",
  "committeeLabel": "Board",
  "features": {
    "hasGroups": true,
    "hasCommittees": true,
    "hasSponsorships": false,
    "hasNOCIssuance": false,
    "hasEventRSVP": true,
    "hasBroadcast": true,
    "hasMembershipExpiry": false,
    "hasDuesAutoGeneration": true
  },
  "financial": { "paymentType": "Mandatory_Recurring", "currency": "INR", "canIssueTaxExemptions": false },
  "idFormat": { "format": "group_member" }
}
```

---

### 3. Shop Owners Association
*Trader federations, market associations*
> Groups (shops) are **optional**. Some associations track shops and owners separately; others just list owners as flat individuals.

```json
{
  "membershipModel": "group_optional",
  "groupLabel": "Shop",
  "memberLabel": "Owner",
  "leaderLabel": "President",
  "donationLabel": "Membership Fee",
  "committeeLabel": "Committee",
  "features": {
    "hasGroups": true,
    "hasCommittees": true,
    "hasSponsorships": true,
    "hasNOCIssuance": false,
    "hasEventRSVP": false,
    "hasBroadcast": true,
    "hasMembershipExpiry": true,
    "hasDuesAutoGeneration": true
  },
  "financial": { "paymentType": "Mandatory_Recurring", "currency": "INR", "canIssueTaxExemptions": false },
  "idFormat": { "format": "group_member" }
}
```
> When `membershipModel: "group_optional"`, a member document's `groupId` field is **nullable**. The UI shows a "No Shop / Independent" option in the member form.

---

### 4. Political & Grassroots Organizations
*Local party chapters, community advocacy groups*
> Groups (wards/branches) are **optional**. Large orgs may use ward grouping; smaller ones may go flat.

```json
{
  "membershipModel": "group_optional",
  "groupLabel": "Ward",
  "memberLabel": "Member",
  "leaderLabel": "Convener",
  "donationLabel": "Contribution",
  "committeeLabel": "Committee",
  "features": {
    "hasGroups": true,
    "hasCommittees": true,
    "hasSponsorships": false,
    "hasNOCIssuance": false,
    "hasEventRSVP": true,
    "hasBroadcast": true,
    "hasMembershipExpiry": false,
    "hasDuesAutoGeneration": false
  },
  "financial": { "paymentType": "Voluntary_AdHoc", "currency": "INR", "canIssueTaxExemptions": false },
  "idFormat": { "format": "group_member" }
}
```

---

### 5. Social & Recreational Clubs
*Rotary, Lions, Sports Clubs, Country Clubs*
> No sub-groups. Members are flat individuals directly under the org.

```json
{
  "membershipModel": "individual_only",
  "groupLabel": null,
  "memberLabel": "Member",
  "leaderLabel": "President",
  "donationLabel": "Subscription",
  "committeeLabel": "Committee",
  "features": {
    "hasGroups": false,
    "hasCommittees": true,
    "hasSponsorships": true,
    "hasNOCIssuance": false,
    "hasEventRSVP": true,
    "hasBroadcast": true,
    "hasMembershipExpiry": true,
    "hasDuesAutoGeneration": true
  },
  "financial": { "paymentType": "Mandatory_Recurring", "currency": "INR", "canIssueTaxExemptions": false },
  "idFormat": { "format": "member_only" }
}
```

---

### 6. Professional Associations & Trade Guilds
*Medical, Bar, Teachers' Associations, Chambers of Commerce*
> No sub-groups. Individual professionals are direct members.

```json
{
  "membershipModel": "individual_only",
  "groupLabel": null,
  "memberLabel": "Member",
  "leaderLabel": "Chairman",
  "donationLabel": "Annual Fee",
  "committeeLabel": "Council",
  "features": {
    "hasGroups": false,
    "hasCommittees": true,
    "hasSponsorships": false,
    "hasNOCIssuance": true,
    "hasEventRSVP": true,
    "hasBroadcast": true,
    "hasMembershipExpiry": true,
    "hasDuesAutoGeneration": true
  },
  "financial": { "paymentType": "Mandatory_Recurring", "currency": "INR", "canIssueTaxExemptions": true },
  "idFormat": { "format": "member_only" }
}
```

---

### 7. Non-Profits, NGOs & Volunteer Groups
*Local charities, relief orgs, environmental groups*
> No sub-groups. Volunteers/donors are flat individuals.

```json
{
  "membershipModel": "individual_only",
  "groupLabel": null,
  "memberLabel": "Volunteer",
  "leaderLabel": "Director",
  "donationLabel": "Donation",
  "committeeLabel": "Board",
  "features": {
    "hasGroups": false,
    "hasCommittees": true,
    "hasSponsorships": true,
    "hasNOCIssuance": false,
    "hasEventRSVP": true,
    "hasBroadcast": true,
    "hasMembershipExpiry": false,
    "hasDuesAutoGeneration": false
  },
  "financial": { "paymentType": "Voluntary_AdHoc", "currency": "INR", "canIssueTaxExemptions": true },
  "idFormat": { "format": "member_only" }
}
```

---

### 8. Alumni Networks & PTAs
*College/School Alumni Associations, Parent-Teacher Associations*
> Optional batch/class grouping. Some alumni bodies group by graduation year; others just go flat.

```json
{
  "membershipModel": "group_optional",
  "groupLabel": "Batch",
  "memberLabel": "Alumni",
  "leaderLabel": "President",
  "donationLabel": "Contribution",
  "committeeLabel": "Committee",
  "features": {
    "hasGroups": true,
    "hasCommittees": true,
    "hasSponsorships": true,
    "hasNOCIssuance": false,
    "hasEventRSVP": true,
    "hasBroadcast": true,
    "hasMembershipExpiry": false,
    "hasDuesAutoGeneration": false
  },
  "financial": { "paymentType": "Voluntary_AdHoc", "currency": "INR", "canIssueTaxExemptions": false },
  "idFormat": { "format": "group_member" }
}
```

---

## ID Format Rules

| `membershipModel` | `idFormat.format` | Example |
|----|----|----|
| `group_required` | `group_member` | `AA-3-7` |
| `group_optional` (with group) | `group_member` | `AA-2-1` |
| `group_optional` (standalone) | `member_only` | `AA-12` |
| `individual_only` | `member_only` | `AA-9` |

> When `group_optional` and a member has no group, the system automatically falls back to `member_only` ID format for that member.
