const { status: httpStatus } = require('http-status');

const { Genre } = require('../../models');
const ApiError = require('../../utils/ApiError');

const createGenre = async (reqBody) => {
    try {
        if (!reqBody.title) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Title is required');
        }
        const genreObj = {
            title: reqBody.title,
            created_at: new Date()
        };
        const genreDoc = await Genre.create(genreObj);
        if (!genreDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Genre');
        }
        return genreDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const updateGenre = async (reqBody, id) => {
    try {
        const genreDoc = await Genre.findByPk(id);

        if (!genreDoc) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Genre not found');
        }
        if (reqBody.title && typeof reqBody.title !== 'undefined' && reqBody.title !== '') {
            genreDoc['title'] = reqBody.title;
        };

        await genreDoc.save();
        return genreDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllGenres = async () => {
    try {
        const genreDoc = await Genre.findAll({
            where: { is_active: 1 },
            order: [['title', 'ASC']]
        });
        if (!genreDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Genre');
        }
        return genreDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const findGenreById = async (id) => {
    try {
        const genreDoc = await Genre.findByPk(id);
        return genreDoc ? genreDoc : {};

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const deleteGenre = async (id) => {
    try {
        const genreDoc = await Genre.findByPk(Number(id));
        if (!genreDoc) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Genre not found');
        }
        return await genreDoc.destroy();

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

module.exports = {
    getAllGenres,
    createGenre,
    updateGenre,
    findGenreById,
    deleteGenre
};