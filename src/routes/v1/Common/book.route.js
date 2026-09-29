const express = require('express');
const router = express.Router();

const { bookController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/', [userAuthMiddleware.verifyAuthJWTToken], bookController.createBook);
router.put('/', [userAuthMiddleware.verifyAuthJWTToken], bookController.updateBook);
router.get('/', [userAuthMiddleware.verifyAuthJWTToken], bookController.getAllBooks);
router.get('/:bookId', [userAuthMiddleware.verifyAuthJWTToken], bookController.getBookById);
router.post('/status/update', [userAuthMiddleware.verifyAuthJWTToken], bookController.bookStatusUpdate);
router.post('/search', [userAuthMiddleware.verifyAuthJWTToken], bookController.searchBooks);
router.delete('/remove', [userAuthMiddleware.verifyAuthJWTToken], bookController.removeBooks);
router.post('/submission/update', [userAuthMiddleware.verifyAuthJWTToken], bookController.bookEventUpdate);
router.post('/submission/history', [userAuthMiddleware.verifyAuthJWTToken], bookController.getBookSubmissionHistory);
router.get('/all/book/submission/history', [userAuthMiddleware.verifyAuthJWTToken], bookController.getAlSubmissions);
router.post('/plagiarism/check', [userAuthMiddleware.verifyAuthJWTToken], bookController.checkPlagiarism);

router.post('/fact/check', [userAuthMiddleware.verifyAuthJWTToken], bookController.factCheckingForChapter);
router.post('/consistency/check', [userAuthMiddleware.verifyAuthJWTToken], bookController.bookConsistancyCheck);
router.post('/chapter/summerize', [userAuthMiddleware.verifyAuthJWTToken], bookController.generateChapterSummary);



// admin api
router.post('/plagiarism/check/admin', bookController.checkPlagiarismAdmin);
router.post('/chapter/summerize/admin', bookController.generateChapterSummaryAdmin);
router.post('/fact/check/admin',bookController.factCheckingForChapterAdmin);
router.post('/consistency/check/admin', bookController.bookConsistencyCheckAdmin);


module.exports = router;