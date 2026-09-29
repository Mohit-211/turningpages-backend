const roleService = require('./role.service');
const departmentService = require('./department.service');
const emailService = require('./email.service');
const tokenService = require('./token.service');
const languageService = require('./language.service');

const genreService = require('./genre.service');
const bookService = require('./book.service');
const chapterService = require('./chapter.service');
const paymentService = require('./payment.service');
const supportService = require('./support.service');
const feedService = require('./feed.service');
const quoteService = require('./quote.service');
const chatService = require('./chat.service');

const subscriptionService = require('./subscription.service');
const tavService = require('./tav.service');


module.exports = {
    roleService,
    departmentService,
    emailService,
    tokenService,
    languageService,
    genreService,
    bookService,
    chapterService,
    paymentService,
    supportService,
    feedService,
    quoteService,
    chatService,
    subscriptionService,
    tavService
};