const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { subscriptionService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');
const pick = require('../../utils/pick');

const createSubscription = catchAsync(async (req, res) => {
    const result = await subscriptionService.createSubscription(req.body);
    return responseWrapper(res, result);
});

const upgradeSubscription = catchAsync(async (req, res) => {
    const result = await subscriptionService.upgradeSubscription(req.body);
    return responseWrapper(res, result);
});

const cancelSubscription = catchAsync(async (req, res) => {
    const result = await subscriptionService.cancelSubscription(req.body);
    return responseWrapper(res, result);
});

const getUserSubscriptions = catchAsync(async (req, res) => {
    const result = await subscriptionService.getUserSubscriptions(req.body);
    return responseWrapper(res, result);
});

const getAllSubscriptions = catchAsync(async (req, res) => {

    const result = await subscriptionService.getAllSubscriptions();
    return responseWrapper(res, result);
});



module.exports = {
    createSubscription,
    upgradeSubscription,
    cancelSubscription,
    getUserSubscriptions,
    getAllSubscriptions
};


