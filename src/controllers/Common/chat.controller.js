const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const responseWrapper = require('../../config/responseWrapper');
const { chatService } = require('../../services');

const createAdminUserChat = catchAsync(async (req, res) => {
    const { user_id } = req.body;
    const adminId = req.body.user.id;

    const chat = await chatService.createAdminUserChat(adminId, user_id);

    return responseWrapper(res, chat, 'Chat created', httpStatus.CREATED);
});

const createBookChat = catchAsync(async (req, res) => {
    const { book_id, user_id, editor_ids } = req.body;
    const adminId = req.body.user.id;

    const chat = await chatService.createBookChat(book_id, adminId, user_id, editor_ids);

    return responseWrapper(res, chat, 'Book chat created', httpStatus.CREATED);
});

const getMyChats = catchAsync(async (req, res) => {
    const chats = await chatService.getUserChats(req.body);
    return responseWrapper(res, chats, '');
});

const getParticipants = catchAsync(async (req, res) => {
    const participants = await chatService.getChatParticipants(req.params.id);
    return responseWrapper(res, participants, '');
});

const sendMessage = catchAsync(async (req, res) => {
    const { chat_room_id, message } = req.body;

    const msgId = await chatService.sendMessage(
        chat_room_id,
        req.body.user.id,
        'user',
        message
    );

    return responseWrapper(res, { msgId }, 'Message sent');
});

const sendMessageAdmin = catchAsync(async (req, res) => {
    const { chat_room_id, message } = req.body;

    const msgId = await chatService.sendMessage(
        chat_room_id,
        req.body.user.id,
        'admin',
        message
    );

    return responseWrapper(res, { msgId }, 'Message sent');
});


const getAllAdminChats = catchAsync(async (req, res) => {
    const chats = await chatService.getAllAdminChats(req.body);
    return responseWrapper(res, chats, '');
});


module.exports = {
    createAdminUserChat,
    createBookChat,
    getMyChats,
    getParticipants,
    sendMessage,
    sendMessageAdmin,

    getAllAdminChats,

};