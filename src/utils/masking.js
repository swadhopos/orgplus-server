/**
 * Sensitive fields that should be masked in logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'credentials',
  'apiKey',
  'otp',
  'cvv',
  'cardNumber'
];

/**
 * Masks sensitive information in an object
 * 
 * @param {any} data - Data to mask
 * @param {string[]} customFields - Optional custom fields to mask
 * @returns {any} Masked data
 */
const maskData = (data, customFields = []) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const fieldsToMask = [...SENSITIVE_FIELDS, ...customFields];

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => maskData(item, customFields));
  }

  // Handle objects
  const masked = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    if (fieldsToMask.some(f => lowerKey.includes(f.toLowerCase()))) {
      masked[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      masked[key] = maskData(value, customFields);
    } else {
      masked[key] = value;
    }
  }

  return masked;
};

module.exports = {
  maskData,
  SENSITIVE_FIELDS
};
