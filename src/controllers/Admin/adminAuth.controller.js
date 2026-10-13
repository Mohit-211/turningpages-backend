const { status: httpStatus } = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { adminAuthService } = require('../../services');
const responseWrapper = require('../../config/responseWrapper');
const pick = require('../../utils/pick');


const createAdminUser = catchAsync(async (req, res) => {
    const body = pick(req.body, ['name', 'email', 'role_id', 'department_id']);
    const result = await adminAuthService.createAdminUser(body);
    return responseWrapper(res, result, 'Admin Created Successfully.', httpStatus.CREATED);
});

const loginAdminUser = catchAsync(async (req, res) => {
    const response = await adminAuthService.loginAdminUser(req.body);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const resetAdminPassword = catchAsync(async (req, res) => {
    const response = await adminAuthService.resetAdminPassword(req.body);
    return responseWrapper(res, response, 'Password Changed Successfully.', httpStatus.OK);
});

const sendOTP = catchAsync(async (req, res) => {
    await adminAuthService.sendOTP(req.body.email);
    return responseWrapper(res, '', 'If an account exists for this email, an OTP has been sent.', httpStatus.OK);
});

const verifyOTP = catchAsync(async (req, res) => {
    const result = await adminAuthService.verifyOTP(req.body.email, req.body.otp);
    return responseWrapper(res, result, 'OTP has been verified', httpStatus.OK);
});

const forgotAdminPassword = catchAsync(async (req, res) => {
    const body = pick(req.body, ['email', 'password', 'confirm_password', 'token']);
    const response = await adminAuthService.forgotAdminPassword(body);
    return responseWrapper(res, '', response, httpStatus.OK);
});

const getProfile = catchAsync(async (req, res) => {
    const response = await adminAuthService.getProfile(req.body);
    return responseWrapper(res, response, '', httpStatus.OK);
});

module.exports = {
    createAdminUser,
    loginAdminUser,
    resetAdminPassword,
    sendOTP,
    verifyOTP,
    forgotAdminPassword,
    getProfile
};
