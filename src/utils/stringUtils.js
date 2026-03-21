/**
 * Escapes special characters in a string to be used safely in a Regular Expression.
 * 
 * @param {string} string - The string to escape
 * @returns {string} The escaped string
 */
function escapeRegex(string) {
    if (!string || typeof string !== 'string') return '';
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    escapeRegex
};
