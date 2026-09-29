const express = require('express');
const router = express.Router();

const { adminOpController } = require('../../../controllers');
const { adminAuthMiddleware } = require('../../../middlewares');


router.get('/projects', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllBooks);
router.get('/projects/:bookId', [adminAuthMiddleware.validateJWTtoken], adminOpController.getBookDetails);
router.post('/projects/update', [adminAuthMiddleware.validateJWTtoken], adminOpController.updateBook);
router.post('/projects/chapter/update', [adminAuthMiddleware.validateJWTtoken], adminOpController.updateChapter);
router.get('/editors', [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin], adminOpController.getAllEditors);
router.post('/editors/assign/book', [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin], adminOpController.assignBookToEditor);
router.get('/users/all', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllUsers);
router.get('/users/details/:userId', [adminAuthMiddleware.validateJWTtoken], adminOpController.getUserDetails);
router.get('/books/editing/queue', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllEditQueueData);
router.post("/book/submission/update", [adminAuthMiddleware.validateJWTtoken], adminOpController.adminBookSubmissionAction);
router.get("/books/submissions/pending", [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllPendingSubmissions);



router.get('/stats/users', adminOpController.getUserStats);
router.get('/stats/editors', adminOpController.getEditorStats);

router.patch("/user/status", [adminAuthMiddleware.validateJWTtoken], adminOpController.updateUserStatus);
router.patch("/editor/status", [adminAuthMiddleware.validateJWTtoken], adminOpController.updateEditorStatus);
router.post("/delivered", [adminAuthMiddleware.validateJWTtoken], adminOpController.bookDeliver);

router.get("/payments/list/all", [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllPayments);
router.post("/payments/details", [adminAuthMiddleware.validateJWTtoken], adminOpController.getPaymentDetails);

router.post("/add/credit", [adminAuthMiddleware.validateJWTtoken], adminOpController.addCreditToUser);

router.delete("/user/:id", [adminAuthMiddleware.validateJWTtoken], adminOpController.deleteUserById);
router.delete("/editor/:id", [adminAuthMiddleware.validateJWTtoken], adminOpController.deleteEditorById);




module.exports = router;