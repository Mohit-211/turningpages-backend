const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { DateTime } = require('luxon')
const config = require('../../config/config');

const { UserToken } = require('../../models');
const { tokenTypes } = require('../../config/types');


const generateToken = (userId, expires, type, role_id) => {
    const payload = {
        sub: userId,
        iat: DateTime.now().toUnixInteger(),
        exp: expires.toUnixInteger(),
        type,
        role_id: role_id,
        // Unique per token, so two tokens issued in the same second never collide
        jti: crypto.randomUUID(),
    };
    return jwt.sign(payload, config.jwt.secret, { algorithm: 'HS256' });
};

const generateAuthTokens = async (user) => {
    const accessTokenExpires = DateTime.now().plus({ days: config.jwt.accessExpirationDays });
    const accessToken = generateToken(user.id, accessTokenExpires, tokenTypes.ACCESS, user.role_id);

    const tokenDoc = await UserToken.create({
        user_id: user.id,
        role_id: user.role_id,
        token_type: tokenTypes.ACCESS,
        token: accessToken,
        expired_at: accessTokenExpires.toJSDate(),
    });

    return {
        access: {
            id: tokenDoc.id,
            token: accessToken,
            expires: accessTokenExpires.toJSDate(),
        },
    };
};

// Ends every session of a user, e.g. after a password change or reset
const revokeAllUserTokens = async (userId) => {
    await UserToken.destroy({ where: { user_id: userId }, force: true });
};


module.exports = {
    generateAuthTokens,
    revokeAllUserTokens,
};
