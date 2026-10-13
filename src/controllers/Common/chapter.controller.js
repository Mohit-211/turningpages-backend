/** @format */

const { status: httpStatus } = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { chapterService } = require("../../services/Common");
const responseWrapper = require("../../config/responseWrapper");
const pick = require("../../utils/pick");

const createChapter = catchAsync(async (req, res) => {
	const body = pick(req.body, ["title", "book_id", "user"]);
	const genre = await chapterService.createChapter(body);
	return responseWrapper(
		res,
		genre,
		"New Chapter Created Successfully",
		httpStatus.CREATED,
	);
});

const updateChapter = catchAsync(async (req, res) => {
	const body = pick(req.body, [
		"title",
		"book_id",
		"user",
		"content",
		"chapter_id",
	]);
	const genre = await chapterService.updateChapter(body);
	return responseWrapper(
		res,
		genre,
		"Chapter Updated Successfully",
		httpStatus.CREATED,
	);
});

const getChapterById = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user"]);
	const params = pick(req.params, ["chapterId"]);
	const genre = await chapterService.getChapterById(body, params);
	return responseWrapper(res, genre);
});

const removeChapter = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "chapter_id"]);
	await chapterService.removeChapter(body);
	return responseWrapper(res, "", "Chapter deleted successfully.");
});

const removeBookCover = catchAsync(async (req, res) => {
	await chapterService.removeBookCover(req.params.id, req.body);
	return responseWrapper(res, "", "Cover Deleted successfully.");
});

// admin apis

const createChapterAdmin = catchAsync(async (req, res) => {
	const body = pick(req.body, ["title", "book_id"]);
	const genre = await chapterService.createChapterAdmin(body);
	return responseWrapper(
		res,
		genre,
		"New genre Created Successfully",
		httpStatus.CREATED,
	);
});

const updateChapterAdmin = catchAsync(async (req, res) => {
	const body = pick(req.body, ["title", "book_id", "content", "chapter_id"]);
	const genre = await chapterService.updateChapterAdmin(body);
	return responseWrapper(
		res,
		genre,
		"New genre Created Successfully",
		httpStatus.CREATED,
	);
});

const removeChapterAdmin = catchAsync(async (req, res) => {
	await chapterService.removeChapterAdmin(req.params.id);
	return responseWrapper(res, "", "Chapter deleted successfully.");
});

const chatWithAssistant = catchAsync(async (req, res) => {
	const body = pick(req.body, [
		"message",
		"conversation_id",
	]);

	body.user = req.body.user;

	const data = await chapterService.chatWithAssistant(body);

	return responseWrapper(
		res,
		data,
		"Assistant response generated successfully.",
	);
});

const createConversation = catchAsync(async (req, res) => {
	const body = pick(req.body, ["title", "user"]);

	const data = await chapterService.createConversation(body);

	return responseWrapper(
		res,
		data,
		"Conversation created successfully.",
	);
});

const getConversationMessages = catchAsync(async (req, res) => {
	const data = await chapterService.getConversationMessages(
		req.params.id,
		req.body.user,
	);

	return responseWrapper(
		res,
		data,
		"Conversation messages fetched successfully.",
	);
});

const getConversationList = catchAsync(async (req, res) => {
	

	const data = await chapterService.getConversationList(req.body);

	return responseWrapper(
		res,
		data,
		"Conversation list fetched successfully.",
	);
});

module.exports = {
	createChapter,
	getChapterById,
	updateChapter,
	removeChapter,
	removeBookCover,

	createChapterAdmin,
	updateChapterAdmin,
	removeChapterAdmin,

	chatWithAssistant,
	createConversation,
	getConversationMessages,
	getConversationList,
};
