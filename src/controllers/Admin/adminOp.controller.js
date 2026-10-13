const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { adminOpService } = require('../../services');
const responseWrapper = require('../../config/responseWrapper');
const pick = require('../../utils/pick');


const getAllBooks = catchAsync(async (req, res) => {
    const result = await adminOpService.getAllBooks(req.body, req.query);
    return responseWrapper(res, result);
});

const getBookDetails = catchAsync(async (req, res) => {
    const result = await adminOpService.getBookDetails(req.params);
    return responseWrapper(res, result);
});

const getAllEditors = catchAsync(async (req, res) => {
    const result = await adminOpService.getAllEditors(req.body, req.query);
    return responseWrapper(res, result);
});

const assignBookToEditor = catchAsync(async (req, res) => {
    const result = await adminOpService.assignBookToEditor(req.body);
    return responseWrapper(res, result, 'Successfully assigned');
});

const createUserWithCredentials = catchAsync(async (req, res) => {
  const response = await adminOpService.createUserWithCredentials(req.body);

  return responseWrapper(
    res,
    response,
    "User created successfully and credentials sent to email",
    httpStatus.CREATED,
  );
});

const getAllUsers = catchAsync(async (req, res) => {
    const result = await adminOpService.getAllUsers(req.body, req.query);
    return responseWrapper(res, result);
});

const getUserDetails = catchAsync(async (req, res) => {
    const result = await adminOpService.getUserDetails(req.params);
    return responseWrapper(res, result);
});

const getAllEditQueueData = catchAsync(async (req, res) => {
    const result = await adminOpService.getAllEditQueueData(req.body);
    return responseWrapper(res, result);
});

const getUserStats = catchAsync(async (req, res) => {
    const result = await adminOpService.getUserStats();
    return responseWrapper(res, result);
});

const getEditorStats = catchAsync(async (req, res) => {
    const result = await adminOpService.getEditorStats();
    return responseWrapper(res, result);
});

const updateUserStatus = catchAsync(async (req, res) => {
    const result = await adminOpService.updateUserStatus(req.body);
    return responseWrapper(res, result);
});

const updateEditorStatus = catchAsync(async (req, res) => {
    const result = await adminOpService.updateEditorStatus(req.body);
    return responseWrapper(res, result);
});

const bookDeliver = catchAsync(async (req, res) => {
    const result = await adminOpService.bookDeliver(
        req.body,
        req.files || null
    );
    return responseWrapper(res, result);
});

const updateBook = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'description', 'genre_id', 'user', 'book_id', 'cover_img_name', 'author']);
    const genre = await adminOpService.updateBook(body);
    return responseWrapper(res, genre, 'Book UpdatedSuccessfully', httpStatus.OK);
});

const updateChapter = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'book_id', 'user', 'content', 'chapter_id']);
    const genre = await adminOpService.updateChapter(body);
    return responseWrapper(res, genre);
});

const getAllPayments = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['user_id']);
    const result = await adminOpService.getAllPayments(body, query);
    return responseWrapper(res, result);
});

const getPaymentDetails = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'payment_id']);
    const result = await adminOpService.getPaymentDetails(body);
    return responseWrapper(res, result);
});

const addCreditToUser = catchAsync(async (req, res) => {
    const result = await adminOpService.adjustUserCredit(req.body);
    return responseWrapper(res, result);
});

const adminBookSubmissionAction = catchAsync(async (req, res) => {
    const genre = await adminOpService.adminBookSubmissionAction(req.body);
    return responseWrapper(res, genre);
});

const getAllPendingSubmissions = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const genre = await adminOpService.getAllPendingSubmissions(body);
    return responseWrapper(res, genre);
});

const deleteUserById = catchAsync(async (req, res) => {
    const genre = await adminOpService.deleteUserById(req.params.id);
    return responseWrapper(res, genre);
});


const deleteEditorById = catchAsync(async (req, res) => {
    const genre = await adminOpService.deleteEditorById(req.params.id);
    return responseWrapper(res, genre);
});


module.exports = {
    getAllBooks,
    getBookDetails,
    getAllEditors,
    assignBookToEditor,
    createUserWithCredentials,
    getAllUsers,
    getUserDetails,
    getAllEditQueueData,
    getUserStats,
    getEditorStats,
    updateUserStatus,
    updateEditorStatus,
    bookDeliver,
    updateBook,
    updateChapter,
    getAllPayments,
    getPaymentDetails,
    addCreditToUser,
    adminBookSubmissionAction,
    getAllPendingSubmissions,
    deleteUserById,
    deleteEditorById
};