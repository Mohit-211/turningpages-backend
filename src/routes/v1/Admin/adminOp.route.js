const express = require('express');
const router = express.Router();

const { adminOpController } = require('../../../controllers');
const { adminAuthMiddleware } = require('../../../middlewares');

const anyAdmin = [adminAuthMiddleware.validateJWTtoken];
const superAdmin = [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin];

router.post("/create-user", superAdmin, adminOpController.createUserWithCredentials);

router.get('/projects', anyAdmin, adminOpController.getAllBooks);
router.get('/projects/:bookId', anyAdmin, adminOpController.getBookDetails);
router.post('/projects/update', anyAdmin, adminOpController.updateBook);
router.post('/projects/chapter/update', anyAdmin, adminOpController.updateChapter);
router.get('/editors', superAdmin, adminOpController.getAllEditors);
router.post('/editors/assign/book', superAdmin, adminOpController.assignBookToEditor);
router.get('/users/all', anyAdmin, adminOpController.getAllUsers);
router.get('/users/details/:userId', anyAdmin, adminOpController.getUserDetails);
router.get('/books/editing/queue', anyAdmin, adminOpController.getAllEditQueueData);
router.post("/book/submission/update", anyAdmin, adminOpController.adminBookSubmissionAction);
router.get("/books/submissions/pending", anyAdmin, adminOpController.getAllPendingSubmissions);

router.get('/stats/users', anyAdmin, adminOpController.getUserStats);
router.get('/stats/editors', anyAdmin, adminOpController.getEditorStats);

router.patch("/user/status", superAdmin, adminOpController.updateUserStatus);
router.patch("/editor/status", superAdmin, adminOpController.updateEditorStatus);
router.post("/delivered", anyAdmin, adminOpController.bookDeliver);

router.get("/payments/list/all", superAdmin, adminOpController.getAllPayments);
router.post("/payments/details", superAdmin, adminOpController.getPaymentDetails);

router.post("/add/credit", superAdmin, adminOpController.addCreditToUser);

router.delete("/user/:id", superAdmin, adminOpController.deleteUserById);
router.delete("/editor/:id", superAdmin, adminOpController.deleteEditorById);

module.exports = router;
