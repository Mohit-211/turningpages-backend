
const catchAsync = require('../../utils/catchAsync');
const { userOpService } = require('../../services');
const pick = require('../../utils/pick');
const responseWrapper = require('../../config/responseWrapper');


const getProfile = catchAsync(async (req, res) => {
    const response = await userOpService.getProfile(req.body);
    return responseWrapper(res, response, '');
});


const deactivateAccount = catchAsync(async (req, res) => {
    const response = await userOpService.deactivateAccount(req.body);
    return responseWrapper(res, response, 'Account Successfully Deactivated.');
});

const updateProfile = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'name', 'mobile', 'language', 'city_id', 'about', 'state_id', 'address', 'latitude', 'longitude', 'profession']);
    const response = await userOpService.updateProfile(body, req.files);
    return responseWrapper(res, response, 'Profile Updated Successfully.');
});

const getDashboardData = catchAsync(async (req, res) => {
    const response = await userOpService.getDashboardData(req.body);
    return responseWrapper(res, response);
});

const createContact = catchAsync(async (req, res) => {
    const body = pick(req.body, ['name', 'email', 'subject', 'message', 'user']);
    const response = await userOpService.createContact(body);
    return responseWrapper(res, response, 'Message sent successfully.');
});

const getUserCreditStats = catchAsync(async (req, res) => {
    const response = await userOpService.getUserCreditStats(req.body);
    return responseWrapper(res, response);
});


module.exports = {
    getProfile,
    deactivateAccount,
    updateProfile,
    getDashboardData,
    createContact,
    getUserCreditStats
};