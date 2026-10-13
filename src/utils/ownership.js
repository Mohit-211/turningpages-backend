const { Book, Chapter } = require('../models');

// Returns the book only if it belongs to the user; null otherwise
const findOwnedBook = (bookId, user, options = {}) =>
    Book.findOne({ ...options, where: { id: bookId, user_id: user.id, is_active: 1 } });

// Returns the chapter only if its book belongs to the user; null otherwise
const findOwnedChapter = (chapterId, user, options = {}) =>
    Chapter.findOne({
        ...options,
        where: { id: chapterId, is_active: 1 },
        include: [
            ...(options.include || []),
            { model: Book, as: 'chapter_book', where: { user_id: user.id }, attributes: [] },
        ],
    });

module.exports = {
    findOwnedBook,
    findOwnedChapter,
};
