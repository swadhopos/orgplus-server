/**
 * certNumber.js — Atomic, race-free certificate number generator.
 *
 * Format: <orgNumber>/<type>/<year>/<seq>
 * Example: AA/NOC/2026/0001  |  AA/MC/2026/0023  |  AA/DC/2026/0005
 *
 * Uses MongoDB's findOneAndUpdate $inc so two simultaneous requests can
 * never get the same sequence number (no double-counting race condition).
 */

const Counter = require('../models/Counter');
const Organization = require('../models/Organization');

/**
 * @param {string} orgId      - MongoDB ObjectId of the organisation
 * @param {'NOC'|'MC'|'DC'}  type  - Certificate type abbreviation
 * @returns {Promise<string>} e.g. "AA/NOC/2026/0001"
 */
async function generateCertNumber(orgId, type) {
    const year = new Date().getFullYear();

    // One counter document per (org, type, year)
    const counterId = `${orgId}::${type}::${year}`;

    const counter = await Counter.findOneAndUpdate(
        { _id: counterId, organizationId: orgId },
        { $inc: { sequenceValue: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const org = await Organization.findById(orgId).select('orgNumber').lean();
    const prefix = org?.orgNumber || 'XX';   // fallback if orgNumber not yet set
    const seq = String(counter.sequenceValue).padStart(4, '0');

    return `${prefix}/${type}/${year}/${seq}`;
}

module.exports = { generateCertNumber };
