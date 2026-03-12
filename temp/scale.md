# Scaling OrgPlus: Target Niches & Multi-Tenant Architecture

Shifting from a purely religious or household-centric model (like a Mahallu, Church, or Temple) to a generalized **individual member-based organization** opens up highly scalable multi-tenant SaaS opportunities.

## Top Target Industries

1. **Social & Recreational Clubs:** Rotary Clubs, Lions Clubs, Sports Clubs, Country Clubs, Book Clubs.
2. **Professional Associations & Trade Guilds:** Medical Associations, Bar Associations (Lawyers), Teachers' Unions, Chambers of Commerce.
3. **Residential Communities (HOAs & RWAs):** Homeowners Associations, Resident Welfare Associations, Apartment Complexes.
4. **Non-Profits, NGOs & Volunteer Groups:** Local charities, environmental groups, relief organizations.
5. **Alumni Networks & PTAs:** College/School Alumni Associations, Parent-Teacher Associations.
6. **Fitness Centers, Dojos & Maker Spaces:** Independent gyms, martial arts studios, yoga centers, co-working spaces.
7. **Political & Grassroots Organizations:** Local political party chapters, community advocacy groups.

---

## Core Architecture Strategy: `orgConfig`

To handle these variations without cloning the codebase, we implement an `orgConfig` JSON structure set during organization creation via the Admin Panel. It handles Terminology, Feature Flags, and Structure.

### 1. Terminology Mapping
Instead of hardcoded strings, the frontend reads variables from the configuration:
```json
{
  "orgType": "Club", // e.g., "Religious", "HOA", "NGO"
  "labels": {
    "member": "Member", // "Resident", "Volunteer", "Devotee"
    "household": null, // "Family", "Unit", "Household"
    "leader": "President", // "Secretary", "Imam", "Vicar"
    "donation": "Subscription", // "Maintenance Fee", "Donation", "Offering"
    "committee": "Board" // "Committee", "Council"
  }
}
```

### 2. Feature Toggles (Hide/Show Modules)
```json
{
  "features": {
    "hasHouseholds": false, // If false, hide family grouping, just use flat individuals
    "hasCommittees": true,  // Show/Hide committee management
    "hasSponsorships": false, // Toggles event sponsorships
    "hasNOCIssuance": false // Toggles document generation and marriage NOCs
  }
}
```

### 3. Financial Configuration
```json
{
  "financial": {
    "paymentType": "Mandatory_Recurring", // vs. "Voluntary_AdHoc"
    "currency": "INR",
    "canIssueTaxExemptions": false
  }
}
```

---

## Required Feature Additions for Scale

To make the app truly universal based on the new niches, consider building these modules:

**1. Subscription / Dues Auto-Generation**
*   **Crucial for:** Clubs, HOAs, Gyms.
*   **Feature:** A billing engine where the system automatically generates a "Due" or "Invoice" for every active member on a scheduled cadence (e.g., the 1st of the month/year).

**2. Member Status & Expiry**
*   **Crucial for:** Gyms, Clubs, Professional Associations.
*   **Feature:** Add `membershipStatus` (Active, Suspended, Expired) and a `validUntil` date to member profiles. Suspended/Expired members should automatically lose app access or services.

**3. Custom Defined ID Formats**
*   **Crucial for:** All Orgs.
*   **Feature:** The configuration dictates the exact algorithm:
    *   *Format A:* `[ORG-CODE]-[HOUSEHOLD]-[MEMBER]` (For HOAs/Religious)
    *   *Format B:* `[ORG-CODE]-[MEMBER-ID]` (For flat individual organizations like Gyms)

**4. Event Ticketing vs. Sponsorship**
*   **Crucial for:** Clubs, NGOs.
*   **Feature:** Add an "Event RSVP" or "Ticketing" module. A generic club might not have event "sponsors," but they definitely need members to RSVP or buy tickets to attend.

**5. Communication & Broadcast Module**
*   **Crucial for:** HOAs, Political Orgs, PTAs.
*   **Feature:** An Admin-level tool to send blanket push notifications, SMS, or Emails to active members (e.g., "Water supply issue," "Meeting starts at 5").
