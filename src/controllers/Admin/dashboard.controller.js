const catchAsync = require('../../utils/catchAsync');
const { adminDashboardService } = require('../../services');
const responseWrapper = require('../../config/responseWrapper');


const getDashboardCounts = catchAsync(async (req, res) => {
    const result = await adminDashboardService.getDashboardCounts(req.body);
    return responseWrapper(res, result);
});

module.exports = {
    getDashboardCounts,
};