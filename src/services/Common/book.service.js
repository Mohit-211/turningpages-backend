/** @format */

const { status: httpStatus } = require("http-status");
const { Op } = require("sequelize");
const axios = require("axios");

const {
	Book,
	Genre,
	Chapter,
	User,
	BookSubmissionRequest,
	UserCreditSpending,
	AssignBookEditor,
	ChatRoom,
	Payment,
	ChatParticipant,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const sequelize = require("../../config/central.db");
const {
  factCheckChapter,
  buildConsistencyPrompt,
  CONSISTANCY_SYSTEM_PROMPT,
  CHAPTER_SUMMARIZATION_SYSTEM_PROMPT,
} = require("../../utils/fact-checking");
const { askGrokConsistancy } = require("../../config/llm.config");
const { createBookChat } = require("./chat.service");
const config = require("../../config/config");
const LLM_MODELS = {
  grok: "grok-3-mini",
  openai: "gpt-4o-mini",
};

const createBook = async (body) => {
  try {
    const { user, title, description, genre_id } = body;
    if (!title || !description || !genre_id) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Please provide required fields: title, description. genre_id",
      );
    }

    if (!user?.total_credit || user?.total_credit < 1) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Insufficient credit remaining.",
      );
    }
    const genreDoc = await Genre.findByPk(genre_id);
    if (!genreDoc) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Invalid genre_id");
    }
    let bookObj = {
      user_id: user.id,
      title: title,
      description: description,
      genre_id,
    };
    const bookDoc = await Book.create(bookObj);
    if (!bookDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create new Book",
      );
    }
    await User.decrement({ total_credit: 1 }, { where: { id: user.id } });
    return bookDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateBook = async (body) => {
  try {
    const { title, description, genre_id, cover_img_name, book_id, author } =
      body;

    if (!book_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required fields: book_id",
      );
    }
    const bookDoc = await Book.findOne({
      where: { id: book_id },
    });

    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "No book found");
    }

    const updateData = {};

    if (genre_id) {
      const genreDoc = await Genre.findByPk(genre_id);
      if (!genreDoc) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid genre_id");
      }
      updateData.genre_id = genre_id;
    }

    if (title) updateData.title = title;
    if (cover_img_name) updateData.cover_img_name = cover_img_name;
    if (description) updateData.description = description;
    if (author) updateData.author = author;

    await Book.update(updateData, {
      where: { id: book_id },
    });

    // ✅ Update related chat room name if title changed
    if (title) {
      await ChatRoom.update(
        {
          name: title, // or room_name depending on your column
        },
        {
          where: {
            book_id: book_id,
          },
        },
      );
    }

    const updatedBook = await Book.findOne({
      where: { id: book_id },
    });

    return updatedBook;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllBooks = async (body) => {
  try {
    const { user } = body;
    const booksDoc = await Book.findAll({
      where: { user_id: user.id, is_active: 1 },
      include: [
        {
          model: BookSubmissionRequest,
          as: "book_submissions",
          attributes: [
            "id",
            "book_id",
            "status",
            "event_name",
            "submited_at",
            "reversal_at",
            "is_active",
          ],
          limit: 1,
          required: false,
          order: [["created_at", "DESC"]],
        },
        {
          model: Genre,
          as: "book_genre",
          attributes: ["id", "title"],
        },
      ],
      order: [["updated_at", "DESC"]],
    });
    if (!booksDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to fetch all books",
      );
    }
    return booksDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getBookById = async (body, params) => {
  try {
    const { bookId } = params;

    if (!bookId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required field: bookId",
      );
    }

    const bookDoc = await Book.findOne({
      where: {
        id: bookId,
        is_active: 1,
      },
      include: [
        {
          model: BookSubmissionRequest,
          as: "book_submissions",
          attributes: [
            "id",
            "book_id",
            "status",
            "event_name",
            "submited_at",
            "reversal_at",
            "is_active",
          ],
          limit: 5,
          required: false,
          order: [["created_at", "DESC"]],
        },
        {
          model: Genre,
          as: "book_genre",
          attributes: ["id", "title"],
        },
        {
          model: Chapter,
          as: "book_chapters",
          attributes: [
            "id",
            "title",
            "content",
            "book_id",
            "description",
            "word_count",
          ],
        },
        {
          model: AssignBookEditor,
          as: "book_editors",
          attributes: [
            "id",
            "book_id",
            "editor_id",
            "assigned_by",
            "is_active",
          ],
          required: false,
        },
        {
          model: ChatRoom,
          as: "book_chat_room",
          where: { type: "BOOK_GROUP" },
          attributes: ["id", "type", "last_message", "last_message_time"],
          required: false,
        },
      ],
    });

    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Book details not found");
    }

    return bookDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const bookStatusUpdate = async (body) => {
  try {
    const { user, book_id, status } = body;

    if (!book_id || !status) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required field: book_id, status",
      );
    }
    if (!["draft", "completed", "in-editing"].includes(status)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status provided");
    }

    const bookDoc = await Book.findOne({
      where: {
        id: book_id,
        user_id: user.id,
        is_active: 1,
      },
    });
    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Book details not found");
    }
    bookDoc.status = status;
    await bookDoc.save();

    // ---------------- SYNC SUBMISSION (ONLY IF EXISTS) ----------------
    if (status === "completed") {
      const existingRequest = await BookSubmissionRequest.findOne({
        where: { book_id },
      });

      if (existingRequest) {
        await existingRequest.update({
          event_name: "completed",
          status: "approved",
          reversal_at: new Date(),
        });
      }
    }
    return bookDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const searchBooks = async (body) => {
  try {
    const { user, title } = body;

    if (title && title.length < 4) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Minimum 4 characters needed to make a search",
      );
    }

    let where = {
      user_id: user.id,
      is_active: 1,
    };

    if (title) {
      where[Op.or] = [{ title: { [Op.like]: `%${title}%` } }];
    }

    const booksDoc = await Book.findAll({
      where,
      include: [
        {
          model: Genre,
          as: "book_genre",
          attributes: ["id", "title"],
        },
      ],
      order: [["title", "ASC"]],
    });

    if (!booksDoc || booksDoc.length === 0) {
      throw new ApiError(httpStatus.NOT_FOUND, "No books found");
    }

    return booksDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Failed to fetch books",
    );
  }
};

const removeBooks = async (body) => {
  const transaction = await sequelize.transaction();

  try {
    const { user, book_id } = body;

    if (!book_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "book_id is required");
    }

    const bookDoc = await Book.findOne({
      where: {
        id: book_id,
        is_active: 1,
        user_id: user.id,
      },
      include: [
        {
          model: Chapter,
          as: "book_chapters",
        },
      ],
      transaction,
    });

    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Book details not found");
    }

    // ✅ 1. Delete chat first
    const chatRoom = await ChatRoom.findOne({
      where: { book_id },
      transaction,
    });

    if (chatRoom) {
      await ChatParticipant.destroy({
        where: { chat_room_id: chatRoom.id },
        transaction,
      });

      await chatRoom.destroy({ transaction });
    }

    // ✅ 2. Delete chapters
    if (bookDoc.book_chapters?.length) {
      await Chapter.destroy({
        where: { book_id },
        transaction,
      });
    }

    // ✅ 3. Delete book
    await bookDoc.destroy({ transaction });

    await transaction.commit();
    return "";
  } catch (error) {
    await transaction.rollback();
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Failed to delete book",
    );
  }
};

const bookEventUpdate = async (body) => {
  console.log(body, "body");

  const transaction = await sequelize.transaction();

  try {
    const { user, book_id, event_name, note } = body;

    // ---------------- VALIDATION ----------------
    if (!book_id || !event_name) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "book_id and event_name are required",
      );
    }

    const allowedEvents = ["submit", "re-submit", "withdraw", "completed"];
    if (!allowedEvents.includes(event_name)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid event_name");
    }

    // ---------------- PACKAGE CHECK ----------------
    const activePackage = await Payment.findOne({
      where: {
        user_id: user.id,
        payment_for: "package_purchase",
        payment_status: "success",
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (!activePackage && event_name === "submit") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please purchase a package to submit a book",
      );
    }

    // ---------------- BOOK CHECK ----------------
    const bookDoc = await Book.findOne({
      where: {
        id: book_id,
        user_id: user.id,
        is_active: 1,
      },
      transaction,
    });

    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Book not found");
    }

    // ---------------- EXISTING REQUEST ----------------
    const existingRequest = await BookSubmissionRequest.findOne({
      where: { book_id },
      transaction,
    });

    let status = "approved";
    let reversalAt = null;

    // ---------------- EVENT LOGIC ----------------
    switch (event_name) {
      case "submit":
        // if (bookDoc.status !== "draft") {
        // 	throw new ApiError(
        // 		httpStatus.BAD_REQUEST,
        // 		"Only draft books can be submitted",
        // 	);
        // }

        // if (existingRequest) {
        // 	throw new ApiError(
        // 		httpStatus.BAD_REQUEST,
        // 		"Book already submitted",
        // 	);
        // }
        break;

      case "re-submit":
        if (!existingRequest) {
          throw new ApiError(httpStatus.BAD_REQUEST, "Submit book first");
        }

        // if (bookDoc.status !== "feedback") {
        // 	throw new ApiError(
        // 		httpStatus.BAD_REQUEST,
        // 		"Re-submit allowed only after feedback",
        // 	);
        // }

        if (!note || !note.trim()) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Note is required for re-submit",
          );
        }

        reversalAt = new Date();
        break;

      case "completed":
        // if (bookDoc.status !== "feedback") {
        // 	throw new ApiError(
        // 		httpStatus.BAD_REQUEST,
        // 		"Book must be in feedback to complete",
        // 	);
        // }
        reversalAt = new Date();
        break;

      case "withdraw":
        // if (bookDoc.status !== "feedback") {
        // 	throw new ApiError(
        // 		httpStatus.BAD_REQUEST,
        // 		"Withdraw allowed only in feedback stage",
        // 	);
        // }
        reversalAt = new Date();
        break;
    }

    // ---------------- UPDATE BOOK STATUS ----------------
    if (["submit", "re-submit"].includes(event_name)) {
      await bookDoc.update({ status: "in-editing" }, { transaction });
    }

    if (event_name === "submit") {
      const existingChat = await ChatRoom.findOne({
        where: { book_id },
        transaction,
      });

      if (!existingChat) {
        await createBookChat(book_id, user.id, transaction);
      }
    }

    if (event_name === "withdraw") {
      await bookDoc.update({ status: "draft" }, { transaction });
    }

    if (event_name === "completed") {
      await bookDoc.update({ status: "completed" }, { transaction });
    }

    // ---------------- UPSERT LOGIC ----------------
    let submissionDoc;

    if (!existingRequest) {
      // ✅ CREATE (first time)
      submissionDoc = await BookSubmissionRequest.create(
        {
          book_id,
          status,
          event_name,
          note: event_name === "re-submit" ? note : null,
          submited_at: new Date(),
          reversal_at: reversalAt,
        },
        { transaction },
      );
    } else {
      // ✅ UPDATE (no new row)
      await existingRequest.update(
        {
          status,
          event_name,
          note: event_name === "re-submit" ? note : existingRequest.note,
          reversal_at: reversalAt,
        },
        { transaction },
      );

      submissionDoc = existingRequest;
    }

    await transaction.commit();
    return submissionDoc;
  } catch (error) {
    await transaction.rollback();
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getBookSubmissionHistory = async (body) => {
  try {
    const { user, event_name, book_id } = body;

    if (!book_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "book_id is required");
    }

    // Validate book ownership
    const bookDoc = await Book.findOne({
      where: {
        id: book_id,
        user_id: user.id,
        is_active: 1,
      },
    });

    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Book not found");
    }

    // Fetch submission history
    const history = await BookSubmissionRequest.findAll({
      where: {
        book_id,
        is_active: 1,
      },
      attributes: [
        "id",
        "status",
        "event_name",
        "submited_at",
        "reversal_at",
        "created_at",
        "payment_status",
        "note",
      ],
      order: [["created_at", "ASC"]],
    });

    return {
      book_id: bookDoc.id,
      book_title: bookDoc.title,
      total_events: history.length,
      history,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAlSubmissions = async (body) => {
  try {
    const { user } = body;
    const bookDocs = await Book.findAll({
      where: { user_id: user.id, is_active: true },
      is_active: 1,
    });
    if (!bookDocs) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No book found");
    }
    const bookIds = bookDocs.map((elm) => elm.id);
    const bookSubmissionRequestDocs = await BookSubmissionRequest.findAll({
      where: {
        book_id: {
          [Op.in]: bookIds,
        },
        event_name: ["submit", "re-submit"],
      },
      attributes: [
        "id",
        "status",
        "event_name",
        "submited_at",
        "reversal_at",
        "created_at",
        "payment_status",
      ],
      order: [["created_at", "DESC"]],
      include: [
        {
          model: Book,
          as: "submission_book",
          required: false,
        },
      ],
    });
    if (!bookSubmissionRequestDocs) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No pending submission found");
    }
    return bookSubmissionRequestDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const countAlphabets = (text = "") => {
  return (text.match(/[a-zA-Z]/g) || []).length;
};

const checkPlagiarism = async (body) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { user, text } = body;

    if (!text || typeof text !== "string") {
      throw new ApiError(400, "Text is required for plagiarism check");
    }

    const alphabetCount = countAlphabets(text);
    if (alphabetCount < 200) {
      throw new ApiError(
        400,
        `Minimum 200 alphabet characters required. Currently provided: ${alphabetCount}`,
      );
    }

    const MAX_CHAR_LIMIT = 10000;

    if (text.length > MAX_CHAR_LIMIT) {
      throw new ApiError(
        400,
        `Maximum ${MAX_CHAR_LIMIT} characters allowed. Currently provided: ${text.length}`,
      );
    }
    // get latest user
    const userDoc = await User.findByPk(user.id, { transaction });

    if (!userDoc || userDoc.total_credit < 1) {
      throw new ApiError(400, "Insufficient credits");
    }

    const remainingCredit = userDoc.total_credit - 2;

    const options = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GOWINSTON_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        language: "auto",
        country: "us",
        excluded_sources: [],
      }),
    };

    console.log("Using key:", process.env.GOWINSTON_API_KEY);
    const plagiarismRes = await fetch(
      "https://api.gowinston.ai/v2/plagiarism",
      options,
    );

    let plagiarismData = await plagiarismRes.json();

    console.log(plagiarismData, "plagiarismData");

    if (plagiarismData?.response?.error === "INSUFFICIENT_CREDIT") {
      throw new ApiError(
        402, // better than 500
        "Plagiarism service is out of credits. Please ask admin to recharge the account.",
      );
    }

    if (!plagiarismData || !plagiarismData.result) {
      console.error("Invalid API response:", plagiarismData);

      throw new ApiError(
        500,
        plagiarismData?.message || "Invalid response from plagiarism API",
      );
    }

    const { score, identicalWordCounts, similarWordCounts, sourceCounts } =
      plagiarismData.result;

    let status = "ORIGINAL";
    let message = "Content is 100% original";

    if (score > 0 && score <= 10 && identicalWordCounts === 0) {
      status = "LOW_RISK";
      message = "Minor similarity detected";
    } else if (score <= 30 && identicalWordCounts > 0) {
      status = "MEDIUM_RISK";
      message = "Noticeable plagiarism detected";
    } else if (score > 30) {
      status = "HIGH_RISK";
      message = "High plagiarism detected";
    }
    // deduct credit
    await userDoc.decrement("total_credit", { by: 2, transaction });

    // store credit log
    await UserCreditSpending.create(
      {
        user_id: user.id,
        credit_spent: 1,
        remaining_credit: remainingCredit,
        event_name: "plagiarism",
      },
      { transaction },
    );

    await transaction.commit();
    // ✅ Final response
    return {
      userId: user?._id,
      plagiarismScore: score,
      status,
      message,
      stats: {
        totalWords: plagiarismData.result.textWordCounts,
        plagiarizedWords: plagiarismData.result.totalPlagiarismWords,
        identicalWords: identicalWordCounts,
        similarWords: similarWordCounts,
        sourcesMatched: sourceCounts,
      },
      others: {
        sources: plagiarismData.sources.slice(0, 5),
        similarWords: plagiarismData.similarWords,
        indexes: plagiarismData.indexes,
        citations: plagiarismData.citations,
        attackDetected: plagiarismData.attackDetected,
      },
    };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Plagiarism check failed",
    );
  }
};

const factCheckingForChapter = async (body) => {
  let transaction;

  try {
    console.log("🚀 Fact check started");

    const { user, text } = body;

    // ✅ Validate input
    if (!text || typeof text !== "string") {
      throw new ApiError(400, "Text is required for fact check");
    }

    const alphabetCount = countAlphabets(text);
    if (alphabetCount < 200) {
      throw new ApiError(
        400,
        `Minimum 200 alphabet characters required. Currently provided: ${alphabetCount}`,
      );
    }

    // ✅ Normalize text
    const normalizeText = (text) => {
      return text
        .replace(/\.(?=[A-Za-z])/g, ". ")
        .replace(/\s+/g, " ")
        .trim();
    };

    const cleanText = normalizeText(text);
    console.log("🧹 Clean text ready");

    // =========================================================
    // ✅ STEP 1: Run AI OUTSIDE transaction
    // =========================================================
    const factCheckResult = await factCheckChapter(cleanText);
    console.log("🧠 Fact check result:", factCheckResult);

    // ✅ Validate response
    if (!factCheckResult || !Array.isArray(factCheckResult)) {
      throw new ApiError(500, "Invalid response from fact-check API");
    }

    if (factCheckResult.length === 0) {
      throw new ApiError(
        400,
        "No factual claims found. Please provide factual content.",
      );
    }

    // =========================================================
    // ✅ STEP 2: Ensure at least ONE result succeeded
    // =========================================================
    const hasAtLeastOneResult = factCheckResult.some(
      (r) => r.verdict !== "PENDING",
    );

    if (!hasAtLeastOneResult) {
      throw new ApiError(500, "Fact check failed. No credits charged.");
    }

    const creditsToDeduct = 2; // 🔥 ALWAYS 1 per API call

    // =========================================================
    // ✅ STEP 3: Start DB transaction
    // =========================================================
    transaction = await sequelize.transaction();

    const userDoc = await User.findByPk(user.id, { transaction });

    if (!userDoc) {
      throw new ApiError(404, "User not found");
    }

    // ✅ Re-check credits
    if (userDoc.total_credit < creditsToDeduct) {
      throw new ApiError(400, "Insufficient credits");
    }

    const remainingCredit = userDoc.total_credit - creditsToDeduct;

    // =========================================================
    // ✅ STEP 4: Deduct 1 credit
    // =========================================================
    await userDoc.decrement("total_credit", {
      by: creditsToDeduct,
      transaction,
    });

    // =========================================================
    // ✅ STEP 5: Store credit log
    // =========================================================
    await UserCreditSpending.create(
      {
        user_id: user.id,
        credit_spent: 1,
        remaining_credit: remainingCredit,
        event_name: "fact_checking",
      },
      { transaction },
    );

    // =========================================================
    // ✅ STEP 6: Commit
    // =========================================================
    await transaction.commit();

    console.log("✅ Transaction committed successfully");

    // ✅ IMPORTANT: keep original response format (NO BREAKING CHANGE)
    return factCheckResult;
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
      console.log("❌ Transaction rolled back");
    }

    console.log("❌ factCheckingForChapter error:", error);

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Fact check failed",
    );
  }
};

const generateConsistencySummary = async (issues, score) => {
  const response = await axios.post(
    "https://api.x.ai/v1/chat/completions",
    {
      model: LLM_MODELS.grok,
      messages: [
        {
          role: "system",
          content: `
You are an expert literary analyst.

Generate a clear overall consistency summary based ONLY on the issues provided.

Rules:
- Mention if multiple unrelated sources/universes are mixed
- Mention major contradictions
- Reflect overall coherence
- Be specific, not generic
- If score is low, be critical

Return ONLY plain text.
          `,
        },
        {
          role: "user",
          content: JSON.stringify({ issues, score }),
        },
      ],
      temperature: 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${config.GROK_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    },
  );

  return response.data.choices[0].message.content;
};

const bookConsistancyCheck = async (body) => {
  try {
    const transaction = await sequelize.transaction();
    const { user, book_id } = body;

    const bookDoc = await Book.findOne({
      where: { id: book_id, is_active: 1 },
      include: [
        {
          model: BookSubmissionRequest,
          as: "book_submissions",
          attributes: [
            "id",
            "book_id",
            "status",
            "event_name",
            "submited_at",
            "reversal_at",
            "is_active",
          ],
          limit: 5,
          required: false,
          order: [["created_at", "DESC"]],
        },
        {
          model: Genre,
          as: "book_genre",
          attributes: ["id", "title"],
        },
        {
          model: Chapter,
          as: "book_chapters",
          attributes: [
            "id",
            "title",
            "content",
            "book_id",
            "description",
            "word_count",
          ],
        },
      ],
    });

    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Book details not found");
    }

    const userDoc = await User.findByPk(user.id, { transaction });

    if (!userDoc || userDoc.total_credit < 1) {
      throw new ApiError(400, "Insufficient credits");
    }

    const remainingCredit = userDoc.total_credit - 1;

    const chapters = bookDoc.book_chapters;
    const CHUNK_SIZE = 2;

    // 🔥 Create chunks
    const chunks = [];
    for (let i = 0; i < chapters.length; i += CHUNK_SIZE) {
      chunks.push({
        chunk: chapters.slice(i, i + CHUNK_SIZE),
        index: i,
      });
    }

    // 🔥 Parallel execution
    const results = await Promise.all(
      chunks.map(async ({ chunk, index }) => {
        const tempBook = {
          ...bookDoc.toJSON(),
          book_chapters: chunk.map((ch, idx) => ({
            ...ch.toJSON(),
            globalIndex: index + idx + 1,
          })),
        };

        const consistanctBlocks = buildConsistencyPrompt(tempBook);

        const messages = [
          { role: "system", content: CONSISTANCY_SYSTEM_PROMPT },
          { role: "user", content: consistanctBlocks },
        ];

        try {
          const response = await askGrokConsistancy(messages);

          const parsed =
            typeof response === "string" ? JSON.parse(response) : response;

          return parsed;
        } catch (err) {
          console.log("Chunk failed:", index, err.message);
          return null;
        }
      }),
    );

    // 🔥 Merge results
    let allIssues = [];
    let chapterSummaries = [];
    let totalScore = 0;
    let count = 0;

    results.forEach((parsed) => {
      if (!parsed) return;

      if (parsed.issues) {
        allIssues.push(...parsed.issues);
      }

      if (parsed.chapter_summary) {
        chapterSummaries.push(...parsed.chapter_summary);
      }

      if (parsed.overall_consistency_score) {
        totalScore += parsed.overall_consistency_score;
        count++;
      }
    });

    const finalResult = {
      overall_consistency_score: count ? Math.round(totalScore / count) : 0,
      issues: allIssues,
      chapter_summary: chapterSummaries,
    };

    const summary = await generateConsistencySummary(
      finalResult.issues,
      finalResult.overall_consistency_score,
    );

    finalResult.summary = summary;

    // ✅ Deduct credit only after success
    await userDoc.decrement("total_credit", { by: 1, transaction });

    await UserCreditSpending.create(
      {
        user_id: user.id,
        credit_spent: 1,
        remaining_credit: remainingCredit,
        event_name: "consistency_check",
      },
      { transaction },
    );

    await transaction.commit();

    console.log(finalResult, "finalResult");

    return finalResult;
  } catch (error) {
    console.log("factCheckingForChapter error:", error);

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Consistency check failed",
    );
  }
};

const generateChapterSummary = async (body) => {
  try {
    const transaction = await sequelize.transaction();
    const { user, chapter_id, book_id } = body;

    const chapterDoc = await Chapter.findOne({
      where: {
        book_id: book_id,
        id: chapter_id,
        is_active: 1,
      },
    });

    if (!chapterDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Chapter details not found");
    }
    if (!chapterDoc?.content) {
      throw new ApiError(httpStatus.NOT_FOUND, "Chapter content not available");
    }
    const userDoc = await User.findByPk(user.id, { transaction });

    if (!userDoc || Number(userDoc.total_credit) < 0.25) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Insufficient credits");
    }

    const remainingCredit = Number(userDoc.total_credit) - 0.25;

    const messages = [
      { role: "system", content: CHAPTER_SUMMARIZATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Summerize this chapter content: ${chapterDoc.content}`,
      },
    ];
    const response = await askGrokConsistancy(messages);

    let parsedResult;

    try {
      parsedResult = JSON.parse(response);
    } catch (err) {
      throw new ApiError(
        httpStatus.BAD_GATEWAY,
        "Invalid JSON returned from AI",
      );
    }
    await userDoc.decrement("total_credit", {
      by: 0.25,
      transaction,
    });

    // store credit log
    await UserCreditSpending.create(
      {
        user_id: user.id,
        credit_spent: 0.25,
        remaining_credit: remainingCredit,
        event_name: "generate_summary",
      },
      { transaction },
    );

    await transaction.commit();

    return parsedResult;
  } catch (error) {
    console.log("factCheckingForChapter error: ", error);
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Plagiarism check failed",
    );
  }
};

//admin tools api

const runPlagiarismCheck = async (text) => {
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer LcOpGqzr3iEO5bk5tlXwv5sgmJFVr4bw8UDP3kTa803a819b`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      language: "auto",
      country: "us",
      excluded_sources: [],
    }),
  };

  const res = await fetch("https://api.gowinston.ai/v2/plagiarism", options);

  const data = await res.json();

  const { score, identicalWordCounts, similarWordCounts, sourceCounts } =
    data.result;

  let status = "ORIGINAL";
  let message = "Content is 100% original";

  if (score > 0 && score <= 10 && identicalWordCounts === 0) {
    status = "LOW_RISK";
    message = "Minor similarity detected";
  } else if (score <= 30 && identicalWordCounts > 0) {
    status = "MEDIUM_RISK";
    message = "Noticeable plagiarism detected";
  } else if (score > 30) {
    status = "HIGH_RISK";
    message = "High plagiarism detected";
  }

  return {
    raw: data,
    score,
    status,
    message,
  };
};

const checkPlagiarismAdmin = async (text) => {
  try {
    if (!text || typeof text !== "string") {
      throw new ApiError(400, "Text is required for plagiarism check");
    }
    console.log("STEP 1: received request");

    const alphabetCount = countAlphabets(text);
    console.log("STEP 2: validated input");
    if (alphabetCount < 200) {
      throw new ApiError(
        400,
        `Minimum 200 alphabet characters required. Currently provided: ${alphabetCount}`,
      );
    }

    // 🚀 NO CREDIT CHECK HERE

    const plagiarismResult = await runPlagiarismCheck(text);
    const plagiarismData = plagiarismResult.raw;

    return {
      plagiarismScore: plagiarismResult.score,
      status: plagiarismResult.status,
      message: plagiarismResult.message,

      stats: {
        totalWords: plagiarismData.result.textWordCounts,
        plagiarizedWords: plagiarismData.result.totalPlagiarismWords,
        identicalWords: plagiarismData.result.identicalWordCounts,
        similarWords: plagiarismData.result.similarWordCounts,
        sourcesMatched: plagiarismData.result.sourceCounts,
      },

      others: {
        sources: plagiarismData.sources?.slice(0, 5),
        similarWords: plagiarismData.similarWords,
        indexes: plagiarismData.indexes,
        citations: plagiarismData.citations,
        attackDetected: plagiarismData.attackDetected,
      },
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Plagiarism check failed",
    );
  }
};

const runChapterSummary = async (chapterContent) => {
  const messages = [
    { role: "system", content: CHAPTER_SUMMARIZATION_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Summarize this chapter content: ${chapterContent}`,
    },
  ];

  const response = await askGrokConsistancy(messages);

  try {
    return JSON.parse(response);
  } catch (err) {
    throw new ApiError(httpStatus.BAD_GATEWAY, "Invalid JSON returned from AI");
  }
};

const generateChapterSummaryAdmin = async (body) => {
  try {
    const { book_id, chapter_id } = body;

    const chapterDoc = await Chapter.findOne({
      where: {
        book_id: book_id,
        id: chapter_id,
        is_active: 1,
      },
    });

    if (!chapterDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Chapter details not found");
    }

    if (!chapterDoc?.content) {
      throw new ApiError(httpStatus.NOT_FOUND, "Chapter content not available");
    }

    // 🚀 NO CREDIT CHECK

    const result = await runChapterSummary(chapterDoc.content);

    return result;
  } catch (error) {
    console.log("generateChapterSummaryAdmin error:", error);

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Summary generation failed",
    );
  }
};

const runFactCheck = async (text) => {
  if (!text || typeof text !== "string") {
    throw new ApiError(400, "Text is required for fact check");
  }

  const alphabetCount = countAlphabets(text);
  if (alphabetCount < 200) {
    throw new ApiError(
      400,
      `Minimum 200 alphabet characters required. Currently provided: ${alphabetCount}`,
    );
  }

  return await factCheckChapter(text);
};

const factCheckingForChapterAdmin = async (text) => {
  try {
    // 🚀 NO CREDIT CHECK
    const result = await runFactCheck(text);

    return result;
  } catch (error) {
    console.log("factCheckingForChapterAdmin error:", error);

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Fact check failed",
    );
  }
};

const runBookConsistencyCheck = async (bookDoc) => {
  const consistanctBlocks = buildConsistencyPrompt(bookDoc);

  const messages = [
    { role: "system", content: CONSISTANCY_SYSTEM_PROMPT },
    { role: "user", content: consistanctBlocks },
  ];

  const response = await askGrokConsistancy(messages);

  try {
    return JSON.parse(response);
  } catch (err) {
    throw new ApiError(httpStatus.BAD_GATEWAY, "Invalid JSON returned from AI");
  }
};

const bookConsistencyCheckAdmin = async (book_id) => {
  try {
    const bookDoc = await Book.findOne({
      where: {
        id: book_id,
        is_active: 1,
      },
      include: [
        {
          model: BookSubmissionRequest,
          as: "book_submissions",
          attributes: [
            "id",
            "book_id",
            "status",
            "event_name",
            "submited_at",
            "reversal_at",
            "is_active",
          ],
          limit: 5,
          required: false,
          order: [["created_at", "DESC"]],
        },
        {
          model: Genre,
          as: "book_genre",
          attributes: ["id", "title"],
        },
        {
          model: Chapter,
          as: "book_chapters",
          attributes: [
            "id",
            "title",
            "content",
            "book_id",
            "description",
            "word_count",
          ],
        },
      ],
    });

    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Book details not found");
    }

    // 🚀 NO CREDIT CHECK

    const result = await runBookConsistencyCheck(bookDoc);

    return result;
  } catch (error) {
    console.log("bookConsistencyCheckAdmin error:", error);

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Consistency check failed",
    );
  }
};

module.exports = {
  createBook,
  getAllBooks,
  getBookById,
  bookStatusUpdate,
  searchBooks,
  removeBooks,
  updateBook,
  bookEventUpdate,
  getBookSubmissionHistory,
  getAlSubmissions,
  checkPlagiarism,
  factCheckingForChapter,
  bookConsistancyCheck,
  generateChapterSummary,

  checkPlagiarismAdmin,
  generateChapterSummaryAdmin,
  factCheckingForChapterAdmin,
  bookConsistencyCheckAdmin,
};
