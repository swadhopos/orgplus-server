const Counter = require('../models/Counter');

/**
 * Resolves the year identity label from OrgConfig and a given Date.
 * @param {Object} orgConfig - The organization's configuration document.
 * @param {Date} date - The date of the transaction.
 * @returns {String} Fiscal year label (e.g. "2526") or Calendar year label (e.g. "26")
 */
function resolveFiscalLabel(orgConfig, date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1 to 12

    const useCalendarYear = orgConfig?.financial?.useCalendarYear || false;
    const startMonth = orgConfig?.financial?.fiscalYearStartMonth || 4; // Default April

    if (useCalendarYear) {
        return year.toString().slice(-2);
    }

    // Fiscal year logic
    let startYear, endYear;
    if (month < startMonth) {
        // We are before the start month of the current calendar year, meaning we belong to previous year's fiscal year
        startYear = year - 1;
        endYear = year;
    } else {
        // We are on or after the start month, belonging to current year's fiscal year
        startYear = year;
        endYear = year + 1;
    }

    return `${startYear.toString().slice(-2)}${endYear.toString().slice(-2)}`;
}

/**
 * Resolves the entity identity string based on source type and source document.
 * @param {String} sourceType - 'event', 'subscription', 'ledger', 'fundraiser', 'membership'
 * @param {Object} sourceDoc - The source document (Event or FeePlan), if applicable.
 * @param {String} fiscalLabel - The resolved year identity.
 * @returns {String} Identity string, e.g. "E007", "F003", or "2526"
 */
function resolveTypeIdentity(sourceType, sourceDoc, fiscalLabel) {
    if (sourceType === 'event') {
        const seq = sourceDoc && sourceDoc.eventSequence ? sourceDoc.eventSequence : 0;
        return `E${seq}`;
    }
    if (sourceType === 'subscription') {
        const seq = sourceDoc && sourceDoc.planSequence ? sourceDoc.planSequence : 0;
        return `F${seq}`;
    }
    // For ledger, fundraiser, membership, use fiscalLabel
    return fiscalLabel;
}

/**
 * Generates a unique receipt number for a transaction, or returns the existing one.
 * @param {Object} transaction - The transaction document
 * @param {Object} org - The organization document
 * @param {Object} orgConfig - The org config document
 * @param {Object} sourceDoc - The contextual source document (Event or FeePlan)
 * @returns {Promise<String>} The receipt number
 */
async function generateReceiptNumber(transaction, org, orgConfig, sourceDoc) {
    if (transaction.receiptNumber) {
        return transaction.receiptNumber;
    }

    const orgId = transaction.organizationId.toString();
    const orgNumber = org.orgNumber || 'ORG';
    const sourceType = transaction.sourceType || 'ledger';
    const date = transaction.date || new Date();

    const fiscalLabel = resolveFiscalLabel(orgConfig, date);
    const identity = resolveTypeIdentity(sourceType, sourceDoc, fiscalLabel);

    let typeCode = 'FIN';
    if (sourceType === 'event') typeCode = 'EVT';
    else if (sourceType === 'subscription') typeCode = 'FEE';
    else if (sourceType === 'fundraiser') typeCode = 'FND';
    else if (sourceType === 'membership') typeCode = 'MBR';

    const counterId = `${orgId}:${typeCode}:${identity}`;

    const counter = await Counter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { sequenceValue: 1 } },
        { new: true, upsert: true }
    );

    const seqPadding = 4;
    const seqStr = counter.sequenceValue.toString().padStart(seqPadding, '0');

    // Format: {ORG_NUMBER}-{TYPE_CODE}-{IDENTITY}-{SEQ}
    const receiptNumber = `${orgNumber}-${typeCode}-${identity}-${seqStr}`;

    // Update the transaction in database
    transaction.receiptNumber = receiptNumber;
    transaction.audit.updatedAt = new Date();
    await transaction.save();

    return receiptNumber;
}

module.exports = {
    resolveFiscalLabel,
    resolveTypeIdentity,
    generateReceiptNumber
};
