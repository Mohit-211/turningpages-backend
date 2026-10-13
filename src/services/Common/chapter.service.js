/** @format */

const { status: httpStatus } = require("http-status");
const {
  Chapter,
  Genre,
  Book,
  UserCreditSpending,
  User,
  Conversation,
  ConversationMessage,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const sequelize = require("../../config/central.db");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const createChapter = async (body) => {
  const transaction = await sequelize.transaction();

  try {
    const { user, title, book_id } = body;

    if (!title || !book_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required fields: title, book_id",
      );
    }

    const bookDoc = await Book.findByPk(book_id);
    if (!bookDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid book_id");
    }

    const chapterDoc = await Chapter.create(
      {
        book_id,
        title,
      },
      { transaction },
    );

    if (!chapterDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create new Chapter",
      );
    }

    // get latest user credit
    const userDoc = await User.findByPk(user.id, { transaction });

    if (userDoc.total_credit <= 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Not enough credit");
    }

    if (Number(userDoc.total_credit) < 0.5) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Not enough credit");
    }

    const remainingCredit = Number(userDoc.total_credit) - 0.5;

    await userDoc.decrement("total_credit", {
      by: 0.5,
      transaction,
    });

    await UserCreditSpending.create(
      {
        user_id: user.id,
        credit_spent: 0.5,
        remaining_credit: remainingCredit,
        event_name: "create_chapter",
      },
      { transaction },
    );

    await transaction.commit();

    return chapterDoc;
  } catch (error) {
    await transaction.rollback();
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateChapter = async (body) => {
  try {
    const transaction = await sequelize.transaction();
    const { user, title, book_id, content, chapter_id } = body;
    if (!book_id || !chapter_id) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Please provide required fields: book_id, chapter_id",
      );
    }
    const bookDoc = await Book.findByPk(book_id);
    if (!bookDoc) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Invalid book_id");
    }
    let chapterObj = {
      book_id: book_id,
    };
    if (title) {
      chapterObj["title"] = title;
    }
    if (content) {
      chapterObj["content"] = content;
      chapterObj["word_count"] = content.trim().split(/\s+/).length;
    }
    const [updatedCount] = await Chapter.update(chapterObj, {
      where: { id: chapter_id },
    });

    if (updatedCount === 0) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Chapter not found or no changes made",
      );
    }

    const chapterDocs = await Chapter.findAll({ book_id });
    if (chapterDocs) {
      let wordCount = 0;
      chapterDocs.map((chapter) => {
        if (chapter.content) {
          wordCount += chapter.content.trim().split(/\s+/).length;
        }
      });
      bookDoc.word_count = wordCount;
      await bookDoc.save();
    }

    // ============================
    // 💰 CREDIT DEDUCTION (2 credits)
    // ============================
    const userDoc = await User.findByPk(user.id, { transaction });

    if (!userDoc || userDoc.total_credit < 1) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Not enough credit");
    }

    const remainingCredit = userDoc.total_credit - 1;

    await userDoc.decrement("total_credit", { by: 1, transaction });

    await UserCreditSpending.create(
      {
        user_id: user.id,
        credit_spent: 1,
        remaining_credit: remainingCredit,
        event_name: "update_chapter",
      },
      { transaction },
    );

    await transaction.commit();

    const updatedChapter = await Chapter.findByPk(chapter_id);
    return updatedChapter;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getChapterById = async (body, params) => {
  try {
    const { chapterId } = params;

    if (!chapterId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required field: chapterId",
      );
    }

    const chapterDoc = await Chapter.findOne({
      where: {
        id: chapterId,
        is_active: 1,
      },
      include: [
        {
          model: Book,
          as: "chapter_book",
          attributes: [
            "id",
            "user_id",
            "genre_id",
            "title",
            "description",
            "status",
            "visibility",
          ],
          include: [
            {
              model: Genre,
              as: "book_genre",
              attributes: ["id", "title"],
            },
          ],
        },
      ],
    });

    if (!chapterDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Chapter details not found");
    }

    return chapterDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const removeChapter = async (body) => {
  try {
    const { chapter_id, user } = body;

    if (!chapter_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required field: chapter_id",
      );
    }

    const chapterDoc = await Chapter.findOne({
      where: {
        id: chapter_id,
        is_active: 1,
      },
    });

    if (!chapterDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Chapter not found");
    }
    await chapterDoc.destroy();

    return chapterDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const removeBookCover = async (id) => {
  try {
    const book = await Book.findOne({
      where: {
        id,
        is_active: 1,
      },
    });

    if (!book) {
      throw new ApiError(httpStatus.NOT_FOUND, "Book not found");
    }

    // ✅ Only remove cover
    book.cover_img_name = null;
    await book.save();

    return book;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

// admin apis

const createChapterAdmin = async (body) => {
  const transaction = await sequelize.transaction();

  try {
    const { title, book_id } = body;

    if (!title || !book_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required fields: title, book_id",
      );
    }

    const bookDoc = await Book.findByPk(book_id);
    if (!bookDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid book_id");
    }

    const chapterDoc = await Chapter.create(
      {
        book_id,
        title,
      },
      { transaction },
    );

    if (!chapterDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create new Chapter",
      );
    }

    await transaction.commit();

    return chapterDoc;
  } catch (error) {
    await transaction.rollback();

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateChapterAdmin = async (body) => {
  try {
    const { title, book_id, content, chapter_id } = body;

    if (!book_id || !chapter_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required fields: book_id, chapter_id",
      );
    }

    const bookDoc = await Book.findByPk(book_id);
    if (!bookDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid book_id");
    }

    let chapterObj = { book_id };

    if (title) chapterObj.title = title;

    if (content) {
      chapterObj.content = content;
      chapterObj.word_count = content.trim().split(/\s+/).length;
    }

    const [updatedCount] = await Chapter.update(chapterObj, {
      where: { id: chapter_id },
    });

    if (updatedCount === 0) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Chapter not found or no changes made",
      );
    }

    // 🔥 update book word count
    const chapterDocs = await Chapter.findAll({ where: { book_id } });

    let wordCount = 0;
    chapterDocs.forEach((c) => {
      if (c.content) {
        wordCount += c.content.trim().split(/\s+/).length;
      }
    });

    bookDoc.word_count = wordCount;
    await bookDoc.save();

    return await Chapter.findByPk(chapter_id);
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const removeChapterAdmin = async (id) => {
  try {
    const chapterDoc = await Chapter.findOne({
      where: {
        id: id,
        is_active: 1,
      },
    });

    if (!chapterDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Chapter not found");
    }

    await chapterDoc.destroy();

    return chapterDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const chatWithAssistant = async (body) => {
  try {
    const { message, conversation_id, user } = body;

    if (!message?.trim()) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required field: message",
      );
    }

    let conversationDoc;

    // ===============================
    // CREATE NEW CONVERSATION IF NOT EXISTS
    // ===============================
    if (!conversation_id) {
      conversationDoc = await Conversation.create({
        user_id: user.id,
        title: message.substring(0, 40),
      });
    } else {
      conversationDoc = await Conversation.findOne({
        where: {
          id: conversation_id,
          is_active: true,
        },
      });

      if (!conversationDoc) {
        throw new ApiError(httpStatus.NOT_FOUND, "Conversation not found");
      }
    }

    // ===============================
    // SAVE USER MESSAGE
    // ===============================
    await ConversationMessage.create({
      conversation_id: conversationDoc.id,
      role: "user",
      message,
    });

    // ===============================
    // FETCH LAST MESSAGES
    // ===============================
    const oldMessages = await ConversationMessage.findAll({
      where: {
        conversation_id: conversationDoc.id,
        is_active: true,
      },
      order: [["created_at", "ASC"]],
      limit: 20,
    });

    // ===============================
    // FORMAT FOR OPENAI
    // ===============================
    const formattedMessages = [
      {
        role: "system",
        content: "You are an assistant",
      },
      ...oldMessages.map((msg) => ({
        role: msg.role,
        content: msg.message,
      })),
    ];

    // ===============================
    // OPENAI RESPONSE
    // ===============================
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 4000,
    });

    const reply = response.choices[0].message.content;

    // ===============================
    // SAVE ASSISTANT MESSAGE
    // ===============================
    await ConversationMessage.create({
      conversation_id: conversationDoc.id,
      role: "assistant",
      message: reply,
    });

    return {
      conversation_id: conversationDoc.id,
      reply,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const createConversation = async (body) => {
  try {
    const { title, user } = body;

    const conversation = await Conversation.create({
      user_id: user.id,
      title: title || "New Chat",
    });

    return conversation;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getConversationMessages = async (conversation_id) => {
  try {
    const messages = await ConversationMessage.findAll({
      where: {
        conversation_id,
        is_active: true,
      },
      order: [["created_at", "ASC"]],
    });

    return messages;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getConversationList = async (body) => {
  try {
    const { user } = body;

    if (!user?.id) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "User not authenticated");
    }

    const conversations = await Conversation.findAll({
      where: {
        user_id: user.id,
        is_active: true,
      },
      attributes: ["id", "title", "created_at", "updated_at"],
      order: [["updated_at", "DESC"]],
    });

    return conversations;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
  createChapter,
  getChapterById,
  updateChapter,
  removeChapter,
  removeBookCover,

  createChapterAdmin,
  updateChapterAdmin,
  removeChapterAdmin,

  chatWithAssistant,
  createConversation,
  getConversationMessages,
  getConversationList,
};
