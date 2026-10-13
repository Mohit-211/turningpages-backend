const { status: httpStatus } = require('http-status');
const jwt = require('jsonwebtoken');

const { Admin, Department } = require('../models');
const validateEmail = require('../helpers/validateEmail');
const validatePassword = require('../helpers/validatePassword');
const catchAsync = require('../utils/catchAsync');
const responseWrapper = require('../config/responseWrapper');

const { roleService } = require('../services');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/types');


const validateCreateAdminBody = catchAsync(async (req, res, next) => {
    const { name, email, role_id, department_id } = req.body;
    if (!name || !email || !role_id || !department_id) {
        return responseWrapper(res, '', 'Please Enter Required Fields : [name || email_id || role_id || department_id]', httpStatus.BAD_REQUEST);
    };

    if (Number(role_id) === config.SUP_ADM_ROLE_ID || Number(role_id) === config.USR_ROLE_ID) {
        return responseWrapper(res, '', 'You are not authorized to create this role.', httpStatus.BAD_REQUEST);
    };

    if (!validateEmail(email) || String(name).trim().length === 0) {
        return responseWrapper(res, '', 'Invalid Name or Email', httpStatus.BAD_REQUEST);
    };

    if (await Admin.isEmailTaken(email)) {
        return responseWrapper(res, '', 'Email already taken', httpStatus.BAD_REQUEST);
    };

    const isValidRoleId = await roleService.findRoleById(parseInt(role_id));
    if (!isValidRoleId) return responseWrapper(res, '', 'Invalid Role Id', httpStatus.BAD_REQUEST);

    const isValidDepartmentId = await Department.findByPk(parseInt(department_id));
    if (!isValidDepartmentId) return responseWrapper(res, '', 'Invalid Department Id', httpStatus.BAD_REQUEST);
    next()
});


const validateLoginAdminBody = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return responseWrapper(res, '', 'Please Enter Required Fields : [ email_id || password ]', httpStatus.BAD_REQUEST);
    };

    if (!validateEmail(email)) {
        return responseWrapper(res, '', 'Invalid Email', httpStatus.BAD_REQUEST);
    };
    next()
});


// Verifies an admin token and attaches the admin to req.user and req.body.user. Throws ApiError(401) when invalid.
const authenticateAdmin = async (req, token) => {
    let decoded;
    try {
        decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    } catch (error) {
        throw new ApiError(httpStatus.UNAUTHORIZED, error.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid Token');
    }
    if (decoded.type !== tokenTypes.ADMIN) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid Token');
    }

    const admin = await Admin.findByPk(decoded.id);
    if (!admin) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'User no longer exists');
    }
    if (!admin.is_active) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Your account has been deactivated');
    }
    // Tokens issued before the last password change are no longer valid
    if (admin.password_changed_at && decoded.iat < Math.floor(admin.password_changed_at.getTime() / 1000)) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Session expired. Please log in again.');
    }

    req.user = admin;
    req.body.user = admin;
    req.body.authType = 'admin';
};

const validateJWTtoken = catchAsync(async (req, res, next) => {
    const token = req.header('x-access-token');
    if (!token) {
        return responseWrapper(res, '', 'Access denied: No token provided', httpStatus.UNAUTHORIZED);
    };
    await authenticateAdmin(req, token);
    next();
});

const validateResetPassordBody = catchAsync(async (req, res, next) => {
    const { old_password, new_password, confirm_password } = req.body;

    if (!old_password || !new_password || !confirm_password) {
        return responseWrapper(res, '', 'Please Enter Required Fields : [ old_password || new_password || confirm_password ]', httpStatus.BAD_REQUEST);
    };

    if (new_password !== confirm_password) {
        return responseWrapper(res, '', 'New Password and Confirm Password Must Be Equal', httpStatus.BAD_REQUEST);
    };

    if (!validatePassword(new_password)) {
        return responseWrapper(res, '', 'Password should have a minimum length of 8 characters and must have at least 2 digits and No Blank Space', httpStatus.BAD_REQUEST);
    };
    next()
});

const isSuperAdmin = catchAsync(async (req, res, next) => {
    if (req.user?.role_id !== config.SUP_ADM_ROLE_ID) {
        return responseWrapper(res, '', 'You are not authorized to access this route', httpStatus.FORBIDDEN);
    };
    next()
});

module.exports = {
    validateCreateAdminBody,
    validateLoginAdminBody,
    authenticateAdmin,
    validateJWTtoken,
    validateResetPassordBody,
    isSuperAdmin,
};
