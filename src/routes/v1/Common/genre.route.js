const express = require('express');
const router = express.Router();

const { genreController } = require('../../../controllers');
const { adminAuthMiddleware, userAuthMiddleware } = require('../../../middlewares');

router.post('/', [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin], genreController.createGenre);
router.get('/', genreController.getAllGenres);
router.get('/:id', genreController.findGenreById);
router.put('/:id', [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin], genreController.updateGenre);
router.delete('/:id', [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin], genreController.deleteGenre);
router.get('/all/admin', [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin], genreController.getAllGenres);

module.exports = router;