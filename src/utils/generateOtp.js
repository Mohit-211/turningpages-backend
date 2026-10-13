const crypto = require('crypto');

// Numeric code of the given length, leading zeros allowed (e.g. "0427")
function generateOtp(length) {
    return crypto.randomInt(0, 10 ** length).toString().padStart(length, '0');
};

module.exports = generateOtp;
