const { status: httpStatus } = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { genreService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');

const getAllGenres = catchAsync(async (req, res) => {
    const genres = await genreService.getAllGenres();
    return responseWrapper(res, genres, '');
});

const createGenre = catchAsync(async (req, res) => {

    const genre = await genreService.createGenre(req.body);
    return responseWrapper(res, genre, 'New genre Created Successfully', httpStatus.CREATED);
});

const updateGenre = catchAsync(async (req, res) => {

    const genreDoc = await genreService.updateGenre(req.body, req.params.id);
    return responseWrapper(res, genreDoc, 'Genre Update Successfully');
});

const findGenreById = catchAsync(async (req, res) => {

    const genreDoc = await genreService.findGenreById(req.params.id);
    return responseWrapper(res, genreDoc, '');
});

const deleteGenre = catchAsync(async (req, res) => {

    await genreService.deleteGenre(req.params.id);
    return responseWrapper(res, '', 'Delete Successfull.', httpStatus.OK);
});

module.exports = {
    getAllGenres,
    createGenre,
    updateGenre,
    findGenreById,
    deleteGenre
};