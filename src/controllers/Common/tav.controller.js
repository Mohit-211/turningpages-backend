const catchAsync = require("../../utils/catchAsync");
const responseWrapper = require("../../config/responseWrapper");
const { tavService } = require("../../services");

const runTavAnalysis = catchAsync(async (req, res) => {

  const result = await tavService.runTavAnalysis(req.body.book_id, req.body);

  return responseWrapper(res, result, "TAV Analysis completed successfully.");
});

module.exports = {
  runTavAnalysis,
};
