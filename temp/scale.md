# Scaling OrgPlus: Target Niches & Multi-Tenant Architecture

Shifting from a purely religious or household-centric model (like a Mahallu, Church, or Temple) to a generalized **individual member-based organization** opens up highly scalable multi-tenant SaaS opportunities.

## What Qualifies as an Organization?

OrgPlus is designed for entities where members have a **collective identity** and the organization exists *for* them — not to sell them a service. A qualifying organization must:
- Be governed by a committee, board, or elected leadership.
- Have members who *belong* to the org, not just *pay* for a service.
- Serve a shared community, professional, or civic goal.

> **Not a fit:** Businesses like gyms, yoga studios, or salons. These are service providers with customers — not organizations with members. They have owners, not committees, and their users have no collective identity or stake in the entity.

## Top Target Niches

1. **Religious & Faith Communities:** Mahallus, Churches, Temples, Mosques, Synagogues.
2. **Social & Recreational Clubs:** Rotary Clubs, Lions Clubs, Sports Clubs, Country Clubs, Book Clubs.
3. **Professional Associations & Trade Guilds:** Medical Associations, Bar Associations, Teachers' Unions, Chambers of Commerce.
4. **Residential Communities (HOAs & RWAs):** Homeowners Associations, Resident Welfare Associations, Apartment Complexes.
5. **Non-Profits, NGOs & Volunteer Groups:** Local charities, environmental groups, relief organizations.
6. **Alumni Networks & PTAs:** College/School Alumni Associations, Parent-Teacher Associations.
7. **Political & Grassroots Organizations:** Local political party chapters, community advocacy groups.

---

## Core Architecture Strategy: `orgConfig`

To handle all variations without cloning the codebase, we implement an `orgConfig` JSON structure set during organization creation via the Admin Panel. **Once saved, this config is locked and non-editable.**

### 1. The Membership Model (Most Critical Field)

The single most important decision when creating an org:

```json
{
  "membershipModel": "group_based",  // or "individual_based"
  "groupLabel": "Shop"               // only relevant when group_based
}
```

- **`group_based`**: The org has intermediate sub-units that members belong to. Data model: **Org → Group → Member**. ID format: `AA-1-3`.
- **`individual_based`**: No sub-grouping. Members are direct children of the Org. Data model: **Org → Member**. ID format: `AA-5`.

The `groupLabel` is what the UI calls the sub-unit. It has no effect on the schema or logic — only on displayed text:

| Org Type | `groupLabel` |
|---|---|
| Mahallu / Church | `Family` / `Household` |
| HOA / Apartment | `Unit` / `Flat` |
| Shop Owners Association | `Shop` |
| Political Party | `Ward` / `Branch` |
| University Alumni | `Batch` / `Department` |

### 2. Terminology Labels
All text labels displayed in the Org App are driven by config:
```json
{
  "labels": {
    "member": "Member",        // "Resident", "Volunteer", "Devotee", "Shop Owner"
    "leader": "President",     // "Secretary", "Imam", "Vicar"
    "donation": "Subscription", // "Maintenance Fee", "Donation", "Offering"
    "committee": "Board"       // "Committee", "Council"
  }
}
```

### 3. Feature Toggles (Hide/Show Modules)
```json
{
  "features": {
    "hasGroups": true,          // drives the group_based flow; false = individual_based UI
    "hasCommittees": true,      // Show/Hide committee management
    "hasSponsorships": false,   // Toggles event sponsorships
    "hasNOCIssuance": false     // Toggles document/NOC generation
  }
}
```

### 4. Financial Configuration
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
*   **Crucial for:** Clubs, HOAs, Professional Associations.
*   **Feature:** A billing engine where the system automatically generates a "Due" or "Invoice" for every active member on a scheduled cadence (e.g., the 1st of the month/year).

**2. Member Status & Expiry**
*   **Crucial for:** Clubs, Professional Associations, Alumni Bodies.
*   **Feature:** Add `membershipStatus` (Active, Suspended, Expired) and a `validUntil` date to member profiles. Suspended/Expired members should automatically lose app access or services.

**3. Custom Defined ID Formats**
*   **Crucial for:** All Orgs.
*   **Feature:** The `membershipModel` in `orgConfig` dictates the ID algorithm:
    *   *Group-Based:* `[ORG-CODE]-[GROUP-NUMBER]-[MEMBER-NUMBER]` (e.g., `AA-4-2` = Shop #4, Member #2)
    *   *Individual-Based:* `[ORG-CODE]-[MEMBER-NUMBER]` (e.g., `AA-17`)

**4. Event Ticketing vs. Sponsorship**
*   **Crucial for:** Clubs, NGOs.
*   **Feature:** Add an "Event RSVP" or "Ticketing" module. A generic club might not have event "sponsors," but they definitely need members to RSVP or buy tickets to attend.

**5. Communication & Broadcast Module**
*   **Crucial for:** HOAs, Political Orgs, PTAs.
*   **Feature:** An Admin-level tool to send blanket push notifications, SMS, or Emails to active members (e.g., "Water supply issue," "Meeting starts at 5").
