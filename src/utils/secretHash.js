const crypto = require('crypto');
const config = require('../config/config');

// OTPs and reset tokens are stored as keyed hashes so a database leak does not expose usable codes.
// 48 hex characters fit the existing VARCHAR(50) otp column.
function hashSecret(value) {
    return crypto.createHmac('sha256', config.jwt.secret).update(String(value)).digest('hex').slice(0, 48);
};

function matchesHash(value, storedHash) {
    if (!value || !storedHash) return false;
    const a = Buffer.from(hashSecret(value));
    const b = Buffer.from(String(storedHash));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

function generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
};

module.exports = {
    hashSecret,
    matchesHash,
    generateResetToken,
};
