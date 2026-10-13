/** @format */

const { status: httpStatus } = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { quoteService } = require("../../services/Common");
const responseWrapper = require("../../config/responseWrapper");
const pick = require("../../utils/pick");

const createQuote = catchAsync(async (req, res) => {
	const body = pick(req.body, ["author", "quote", "desc", "tags", "quotes", "add_type"]);

	const data = await quoteService.createQuote(body);

	return responseWrapper(
		res,
		data,
		"Quote created successfully",
		httpStatus.CREATED,
	);
});

const updateQuote = catchAsync(async (req, res) => {
	const { quote_id } = req.params;

	const body = pick(req.body, ["author", "quote", "desc", "tags"]);

	const data = await quoteService.updateQuote(quote_id, body);

	return responseWrapper(res, data, "Quote updated", httpStatus.OK);
});

const deleteQuote = catchAsync(async (req, res) => {
	const { quote_id } = req.params;

	await quoteService.deleteQuote(quote_id);

	return responseWrapper(res, null, "Quote deleted", httpStatus.OK);
});

const getQuotes = catchAsync(async (req, res) => {
	const query = pick(req.query, ["page", "limit", "tag", "search", "sort"]);

	const data = await quoteService.getQuotes(query);

	return responseWrapper(res, data, "Quotes fetched", httpStatus.OK);
});

const getQuoteById = catchAsync(async (req, res) => {
	const { quote_id } = req.params;

	const data = await quoteService.getQuoteById(quote_id);

	return responseWrapper(res, data, "Quote fetched", httpStatus.OK);
});

const getQuotesByTag = catchAsync(async (req, res) => {
	const { slug } = req.params;
	const query = pick(req.query, ["page", "limit"]);

	const data = await quoteService.getQuotesByTag(slug, query);

	return responseWrapper(res, data, "Quotes fetched", httpStatus.OK);
});

const getAllTags = catchAsync(async (req, res) => {
	const query = pick(req.query, ["page", "limit", "search", "sort"]);

	const data = await quoteService.getAllTags(query);

	return responseWrapper(res, data, "Tags fetched successfully", httpStatus.OK);
});

const createTag = catchAsync(async (req, res) => {
	const data = await quoteService.createTag(req.body);

	return responseWrapper(
		res,
		data,
		"Tag created successfully",
		httpStatus.CREATED,
	);
});

const updateTag = catchAsync(async (req, res) => {
	const data = await quoteService.updateTag(req.params.id, req.body);

	return responseWrapper(res, data, "Tag updated", httpStatus.OK);
});

const deleteTag = catchAsync(async (req, res) => {

	await quoteService.deleteTag(req.params.id);

	return responseWrapper(res, null, "Tag deleted", httpStatus.OK);
});

module.exports = {
	createQuote,
	updateQuote,
	deleteQuote,
	getQuotes,
	getQuoteById,
	getQuotesByTag,
	getAllTags,
	createTag,
	updateTag,
	deleteTag,
};
