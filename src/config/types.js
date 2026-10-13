const userStatusTypes = {
    ACCEPTED: 'ACCEPTED',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED',
    REVIEWING: 'REVIEWING',
    REVIEWED: 'REVIEWED',
};

const otpTypes = {
    EMAIL_VERIFICATION: 'email_varification',
    MOBILE_VERIFICATION: 'mobile_varification',
    FORGOT_PASSWORD: 'forgot_password',
    RESET_PASSWORD: 'reset_password'
};

const tokenTypes = {
    ACCESS: 'access',
    REFRESH: 'refresh',
    VERIFY_EMAIL: 'email_varification',
    FORGOT_PASSWORD: 'forgot_password',
    RESET_PASSWORD: 'reset_password',
    SESSION: 'session',
    ADMIN: 'admin',
};

const bookStatus = {
    completed: 'completed',
    draft: 'draft',
    in_editing: 'in-editing',
};

module.exports = {
    userStatusTypes,
    otpTypes,
    tokenTypes,
    bookStatus,
};
