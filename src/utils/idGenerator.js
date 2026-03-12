/**
 * Utility functions for generating custom hierarchical IDs.
 */

/**
 * Generates the next sequential alphabetical ID.
 * Examples:
 * 'A' -> 'B'
 * 'Z' -> 'AA'
 * 'AA' -> 'AB'
 * 'AZ' -> 'BA'
 * 'ZZ' -> 'AAA'
 *
 * @param {string} currentId - The current alphabetic ID (e.g., 'AA'). If falsy, returns 'AA'.
 * @returns {string} The next alphabetic ID.
 */
function getNextAlphaId(currentId) {
    if (!currentId) {
        return 'AA'; // Start sequence from AA
    }

    const chars = currentId.toUpperCase().split('');
    let carry = true;

    for (let i = chars.length - 1; i >= 0; i--) {
        if (!carry) break;

        if (chars[i] === 'Z') {
            chars[i] = 'A';
            carry = true;
        } else {
            chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
            carry = false;
        }
    }

    if (carry) {
        chars.unshift('A');
    }

    let nextId = chars.join('');

    // As requested by user, the minimal ID is 2 characters 'AA'.
    // If we somehow get 'B' (from passing 'A'), we shouldn't pad to 'AB' blindly,
    // but the system naturally handles starting from 'AA'.
    // Just in case a 1-character ID made its way in, we pad to maintain 2 chars minimum.
    if (nextId.length === 1) {
        nextId = 'A' + nextId;
    }

    return nextId;
}

module.exports = {
    getNextAlphaId
};
