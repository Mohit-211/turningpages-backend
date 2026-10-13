const { status: httpStatus } = require('http-status');
const jwt = require('jsonwebtoken');

const catchAsync = require('../utils/catchAsync');
const responseWrapper = require('../config/responseWrapper');
const { tokenTypes } = require('../config/types');
const { authenticateAdmin } = require('./adminAuth.middleware');
const { authenticateUser } = require('./userAuth.middleware');

// For routes used by both the user app and the admin panel.
// Sets req.body.authType to 'admin' or 'user' so services can apply ownership rules.
const verifyUserOrAdmin = catchAsync(async (req, res, next) => {
    const token = req.headers['x-access-token'];
    if (!token) {
        return responseWrapper(res, '', 'Please authenticate', httpStatus.UNAUTHORIZED);
    }
    // decode only picks the right verifier; each verifier checks the signature itself
    const decoded = jwt.decode(token);
    if (decoded?.type === tokenTypes.ADMIN) {
        await authenticateAdmin(req, token);
    } else {
        await authenticateUser(req, token);
    }
    next();
});

module.exports = {
    verifyUserOrAdmin,
};
