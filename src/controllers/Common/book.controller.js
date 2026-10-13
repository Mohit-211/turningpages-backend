/** @format */

const { status: httpStatus } = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { bookService } = require("../../services/Common");
const responseWrapper = require("../../config/responseWrapper");
const pick = require("../../utils/pick");

const createBook = catchAsync(async (req, res) => {
	const body = pick(req.body, ["title", "description", "genre_id", "user"]);
	const genre = await bookService.createBook(body);
	return responseWrapper(
		res,
		genre,
		"New Book Created Successfully",
		httpStatus.CREATED,
	);
});

const updateBook = catchAsync(async (req, res) => {
	const body = pick(req.body, [
		"title",
		"description",
		"genre_id",
		"book_id",
		"cover_img_name",
		"author",
		"user",
	]);
	const genre = await bookService.updateBook(body);
	return responseWrapper(
		res,
		genre,
		"Book Updated Successfully",
		httpStatus.OK,
	);
});

const getAllBooks = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user"]);
	const genre = await bookService.getAllBooks(body);
	return responseWrapper(res, genre);
});

const getBookById = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user"]);
	const params = pick(req.params, ["bookId"]);
	const genre = await bookService.getBookById(body, params);
	return responseWrapper(res, genre);
});

const bookStatusUpdate = catchAsync(async (req, res) => {
	const genre = await bookService.bookStatusUpdate(req.body);
	return responseWrapper(res, genre);
});

const searchBooks = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "title"]);
	const genre = await bookService.searchBooks(body);
	return responseWrapper(res, genre);
});

const removeBooks = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "book_id"]);
	await bookService.removeBooks(body);
	return responseWrapper(res, "", "Book and its chapters deleted successfully");
});

const bookEventUpdate = catchAsync(async (req, res) => {
	const result = await bookService.bookEventUpdate(req.body);

	const messageMap = {
		submit: "Book submitted successfully",
		"re-submit": "Book re-submitted successfully",
		completed: "Book marked as completed",
		withdraw: "Book withdrawn successfully",
	};

	return responseWrapper(
		res,
		result,
		messageMap[req.body.event_name] || "Book updated successfully",
		httpStatus.OK,
	);
});

const getBookSubmissionHistory = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "event_name", "book_id"]);
	const genre = await bookService.getBookSubmissionHistory(body);
	return responseWrapper(res, genre);
});

const getAlSubmissions = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user"]);
	const genre = await bookService.getAlSubmissions(body);
	return responseWrapper(res, genre);
});

const checkPlagiarism = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "text"]);
	const genre = await bookService.checkPlagiarism(body);
	return responseWrapper(res, genre);
});

const factCheckingForChapter = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "text"]);
	const genre = await bookService.factCheckingForChapter(body);
	return responseWrapper(res, genre);
});

const bookConsistancyCheck = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "book_id"]);
	const result = await bookService.bookConsistancyCheck(body);
	return responseWrapper(res, result);
});

const generateChapterSummary = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "book_id", "chapter_id"]);
	const result = await bookService.generateChapterSummary(body);
	return responseWrapper(res, result);
});

// admin api
const checkPlagiarismAdmin = catchAsync(async (req, res) => {
	const genre = await bookService.checkPlagiarismAdmin(req.body.text);
	return responseWrapper(res, genre);
});

const generateChapterSummaryAdmin = catchAsync(async (req, res) => {
	const body = pick(req.body, ["book_id", "chapter_id"]);
	const result = await bookService.generateChapterSummaryAdmin(body);
	return responseWrapper(res, result);
});

const factCheckingForChapterAdmin = catchAsync(async (req, res) => {
	const genre = await bookService.factCheckingForChapterAdmin(req.body.text);
	return responseWrapper(res, genre);
});

const bookConsistencyCheckAdmin = catchAsync(async (req, res) => {
	const result = await bookService.bookConsistencyCheckAdmin(req.body.book_id);
	return responseWrapper(res, result);
});

module.exports = {
	createBook,
	getAllBooks,
	getBookById,
	bookStatusUpdate,
	searchBooks,
	removeBooks,
	updateBook,
	bookEventUpdate,
	getBookSubmissionHistory,
	getAlSubmissions,
	checkPlagiarism,
	factCheckingForChapter,
	bookConsistancyCheck,
	generateChapterSummary,

	checkPlagiarismAdmin,
	generateChapterSummaryAdmin,
	factCheckingForChapterAdmin,
	bookConsistencyCheckAdmin,
};
