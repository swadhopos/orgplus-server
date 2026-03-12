/**
 * billing.js
 * Utilities for calculating billing periods and related financial timeframes.
 */

/**
 * Generates a period identifier string based on frequency and date.
 * @param {string} frequency - WEEKLY, MONTHLY, QUARTERLY, YEARLY
 * @param {Date|string} date - The date to calculate for
 * @returns {string|null}
 */
function generateBillingPeriod(frequency, date) {
    if (!frequency) return null;
    
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');

    switch (frequency) {
        case 'MONTHLY':
            return `${year}-${month}`;
        case 'WEEKLY':
            const weekNumber = getWeekNumber(d);
            return `${year}-W${String(weekNumber).padStart(2, '0')}`;
        case 'QUARTERLY':
            const quarter = Math.floor(d.getMonth() / 3) + 1;
            return `${year}-Q${quarter}`;
        case 'YEARLY':
            return String(year);
        default:
            return null;
    }
}

/**
 * ISO-8601 week number calculation
 */
function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

module.exports = {
    generateBillingPeriod
};
