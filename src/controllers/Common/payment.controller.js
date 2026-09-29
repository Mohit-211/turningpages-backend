const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { paymentService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');
const pick = require('../../utils/pick');

const getStripePaymentIntent = catchAsync(async (req, res) => {

    const result = await paymentService.getStripePaymentIntent(req.body);
    return responseWrapper(res, result);
});

const stripeWebhook = catchAsync(async (req, res) => {
    const result = await paymentService.stripeWebhook(req.body, req.headers);
    return responseWrapper(res, result);
});

const getAllPayments = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const result = await paymentService.getAllPayments(body);
    return responseWrapper(res, result);
});

const getPaymentDetails = catchAsync(async (req, res) => {
    const body = pick(req.body, ['payment_id', 'user']);
    const result = await paymentService.getPaymentDetails(body);
    return responseWrapper(res, result);
});

const getCreditSpentList = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const result = await paymentService.getCreditSpentList(body);
    return responseWrapper(res, result);
});

const getAllPaymentList = catchAsync(async (req, res) => {

    const result = await paymentService.getAllPaymentList();
    return responseWrapper(res, result);
});

module.exports = {
    getStripePaymentIntent,
    stripeWebhook,
    getAllPayments,
    getPaymentDetails,
    getCreditSpentList,
    getAllPaymentList
};