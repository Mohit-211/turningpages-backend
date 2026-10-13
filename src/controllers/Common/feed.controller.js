const { status: httpStatus } = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { feedService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');
const pick = require('../../utils/pick');


/**
 * ===============================
 * CREATE FEED
 * ===============================
 */
const createFeed = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'title',
        'content',
        'genre_id',
        'visibility',
        'tags',
        'user'
    ]);

    const feed = await feedService.createFeed(body, req.files);

    return responseWrapper(
        res,
        feed,
        'Feed created successfully',
        httpStatus.CREATED
    );
});

const updateFeed = catchAsync(async (req, res) => {

    const { feed_id } = req.params;

    const body = pick(req.body, [
        'title',
        'content',
        'genre_id',
        'visibility',
        'tags',
        'user'
    ]);

    const feed = await feedService.updateFeed(feed_id, body, req.files);

    return responseWrapper(
        res,
        feed,
        'Feed updated successfully',
        httpStatus.OK
    );
});

/**
 * ===============================
 * GET ALL FEEDS (Pagination + Filter)
 * ===============================
 */
const getFeeds = catchAsync(async (req, res) => {

    const query = pick(req.query, [
        'page',
        'limit',
        'genre_id',
        'user_id',
        'user'
    ]);
    const body = pick(req.body, [
        'user'
    ]);
    const feeds = await feedService.getFeeds(body, query);

    return responseWrapper(
        res,
        feeds,
        'Feeds fetched successfully',
        httpStatus.OK
    );
});


/**
 * ===============================
 * GET SINGLE FEED
 * ===============================
 */
const getFeedById = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'user'
    ]);
    const { feed_id } = req.params;

    const feed = await feedService.getFeedById(body, feed_id);

    return responseWrapper(
        res,
        feed,
        'Feed fetched successfully',
        httpStatus.OK
    );
});

const getMyFeeds = catchAsync(async (req, res) => {

    const query = pick(req.query, [
        'page',
        'limit',
        'genre_id',
    ]);
    const body = pick(req.body, [
        'user'
    ]);
    const feeds = await feedService.getMyFeeds(body, query);

    return responseWrapper(
        res,
        feeds,
        'Feeds fetched successfully',
        httpStatus.OK
    );
});



/**
 * ===============================
 * DELETE FEED
 * ===============================
 */
const deleteFeed = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'user'
    ]);
    const { feed_id } = req.params;

    await feedService.deleteFeed(body, feed_id);

    return responseWrapper(
        res,
        null,
        'Feed deleted successfully',
        httpStatus.OK
    );
});


/**
 * ===============================
 * CREATE COMMENT / REPLY
 * ===============================
 */
const createComment = catchAsync(async (req, res) => {

    const body = pick(req.body, [
        'feed_id',
        'content',
        'parent_id',
        'user'
    ]);

    const comment = await feedService.createComment(body);

    return responseWrapper(
        res,
        comment,
        'Comment created successfully',
        httpStatus.CREATED
    );
});


/**
 * ===============================
 * GET COMMENTS
 * ===============================
 */
const getFeedComments = catchAsync(async (req, res) => {

    const { feed_id } = req.params;

    const comments = await feedService.getFeedComments(feed_id);

    return responseWrapper(
        res,
        comments,
        'Comments fetched successfully',
        httpStatus.OK
    );
});


/**
 * ===============================
 * TOGGLE LIKE
 * ===============================
 */
const toggleLikeFeed = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'user'
    ]);
    const { feed_id } = req.params;

    const result = await feedService.toggleLikeFeed(body, feed_id);

    return responseWrapper(
        res,
        result,
        result.liked ? 'Feed liked successfully' : 'Feed unliked successfully',
        httpStatus.OK
    );
});

const getAllFeeds = catchAsync(async (req, res) => {
    const query = pick(req.query, [
        'page',
        'limit',
        'genre_id',
        'user_id',
        'user'
    ]);



    const feeds = await feedService.getAllFeeds(query);

    return responseWrapper(
        res,
        feeds,
        "Feeds fetched successfully",
        httpStatus.OK
    );
});

const getFeedByIdForAdmin = catchAsync(async (req, res) => {

    const feed = await feedService.getFeedByIdForAdmin(req.params.feed_id);

    return responseWrapper(
        res,
        feed,
        'Feed fetched successfully',
        httpStatus.OK
    );
});

const getAllDirectories = catchAsync(async (req, res) => {
    const result = await feedService.getAllDirectories(req.body);
    return responseWrapper(res, result);
});

module.exports = {
    createFeed,
    updateFeed,
    getFeeds,
    getMyFeeds,
    getFeedById,
    deleteFeed,
    createComment,
    getFeedComments,
    toggleLikeFeed,
    getAllFeeds,
    getFeedByIdForAdmin,
    getAllDirectories,
};