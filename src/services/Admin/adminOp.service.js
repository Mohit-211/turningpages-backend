/** @format */

const { status: httpStatus } = require("http-status");
const { Sequelize, Op } = require("sequelize");
const sequelize = require("../../config/central.db");
const {
  Book,
  User,
  Profile,
  UserAttachment,
  Genre,
  Chapter,
  Admin,
  Role,
  Department,
  AssignBookEditor,
  Payment,
  BookSubmissionRequest,
  ChatRoom,
  ChatParticipant,
  UserCreditTransaction,
} = require("../../models");
const bcrypt = require("bcryptjs");
const ApiError = require("../../utils/ApiError");
const { bookStatus, userStatusTypes } = require("../../config/types");
const { participantRoles } = require("../../models/chatParticipant.model");
const { sendUserCredentials } = require("../Common/email.service");
const config = require("../../config/config");

// Super admins may act on any book; other admins only on books assigned to them
const assertCanEditBook = async (user, bookId) => {
  if (user.role_id === config.SUP_ADM_ROLE_ID) return;
  const assignment = await AssignBookEditor.findOne({
    where: { book_id: bookId, editor_id: user.id, is_active: true },
  });
  if (!assignment) {
    throw new ApiError(httpStatus.FORBIDDEN, "You are not assigned to this book");
  }
};

const getAllBooks = async (body, query) => {
  try {
    const { user } = body;
    let where = {};
    if (user.role_id !== config.SUP_ADM_ROLE_ID) {
      where["editor_id"] = user.id;
    }

    let include = [
      {
        model: Profile,
        as: "user_profile",
        attributes: [
          "id",
          "name",
          "mobile",
          "is_active",
          "created_at",
          "overall_ratings",
          "no_of_user_rated",
          "no_of_user_reviewed",
        ],
      },
      {
        model: UserAttachment,
        as: "user_attachments",
        attributes: [
          "id",
          "title",
          "file_type",
          "file_name",
          "file_uri",
          "role_id",
        ],
        where: { title: "Profile Image" },
        order: [["id", "desc"]],
        limit: 1,
      },
    ];
    const { userId } = query;
    const filter = { is_active: 1 };
    if (userId) {
      filter["user_id"] = userId;
    }
    const booksDoc = await Book.findAll({
      where: filter,
      include: [
        {
          model: Genre,
          as: "book_genre",
          attributes: ["id", "title"],
        },
        {
          model: User,
          as: "book_user",
          attributes: ["id", "email", "role_id", "status", "is_active"],
          include: include,
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
          where: where,
          required: user.role_id !== config.SUP_ADM_ROLE_ID ? true : false,
          include: [
            {
              model: Admin,
              as: "editor",
              attributes: [
                "id",
                "name",
                "email",
                "role_id",
                "department_id",
                "is_active",
              ],
              include: [
                {
                  model: Role,
                  as: "admin_role",
                  attributes: ["id", "name", "abbreviation"],
                },
                {
                  model: Department,
                  as: "admin_department",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        },
        {
          model: BookSubmissionRequest,
          as: "book_submissions",
          attributes: [
            "id",
            "status",
            "event_name",
            "note",
            "submited_at",
            "reversal_at",
          ],
          required: false, // important (don’t filter books without submission)
        },
      ],
      order: [["created_at", "DESC"]],
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

const getBookDetails = async (params, body) => {
  try {
    const { bookId } = params;
    await assertCanEditBook(body.user, bookId);
    let include = [
      {
        model: Profile,
        as: "user_profile",
        attributes: [
          "id",
          "name",
          "mobile",
          "is_active",
          "created_at",
          "overall_ratings",
          "no_of_user_rated",
          "no_of_user_reviewed",
        ],
      },
      {
        model: UserAttachment,
        as: "user_attachments",
        attributes: [
          "id",
          "title",
          "file_type",
          "file_name",
          "file_uri",
          "role_id",
        ],
        where: { title: "Profile Image" },
        order: [["id", "desc"]],
        limit: 1,
      },
      {
        model: Book,
        as: "user_books",
        attributes: [
          "id",
          "user_id",
          "title",
          "status",
          "genre_id",
          "created_at",
          "updated_at",
        ],
        required: false,
        where: {
          id: {
            [Op.ne]: bookId,
          },
        },
      },
    ];
    const filter = { is_active: 1, id: bookId };

    const bookDoc = await Book.findOne({
      where: filter,
      include: [
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
          model: User,
          as: "book_user",
          attributes: ["id", "email", "role_id", "status", "is_active"],
          include: include,
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
          include: [
            {
              model: Admin,
              as: "editor",
              attributes: [
                "id",
                "name",
                "email",
                "role_id",
                "department_id",
                "is_active",
              ],
              include: [
                {
                  model: Role,
                  as: "admin_role",
                  attributes: ["id", "name", "abbreviation"],
                },
                {
                  model: Department,
                  as: "admin_department",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        },
      ],
      orderBy: [["created_at", "DESC"]],
    });
    if (!bookDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to fetch book details",
      );
    }
    return bookDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllEditors = async (body, query) => {
  try {
    const { userId } = query;
    const filter = { is_active: 1 };
    if (userId) {
      filter["id"] = userId;
    }
    const booksDoc = await Admin.findAll({
      where: filter,
      attributes: [
        "id",
        "name",
        "email",
        "role_id",
        "department_id",
        "is_active",
        "created_at",
      ],
      orderBy: [["created_at", "ASC"]],
      include: [
        {
          model: Role,
          as: "admin_role",
          attributes: ["id", "name", "abbreviation"],
        },
        {
          model: Department,
          as: "admin_department",
          attributes: ["id", "name"],
        },
        {
          model: AssignBookEditor,
          as: "editor_assign_books",
          attributes: ["id", "book_id", "editor_id", "assigned_by"],
          limit: 1,
        },
      ],
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

const assignBookToEditor = async (body) => {
  try {
    const { book_id, editor_id, user } = body;

    const bookDoc = await Book.findOne({
      where: { id: book_id, is_active: 1 },
    });
    if (!bookDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid book id");
    }

    const editorDoc = await Admin.findOne({
      where: { id: editor_id },
    });
    if (!editorDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid editor id");
    }

    const existingAssignment = await AssignBookEditor.findOne({
      where: {
        book_id,
        is_active: true,
      },
    });

    // 🔍 find chat room
    const chatRoom = await ChatRoom.findOne({
      where: { book_id },
    });

    if (!chatRoom) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Chat room not found");
    }

    // =========================
    // 🔁 UPDATE EXISTING EDITOR
    // =========================
    if (existingAssignment) {
      const oldEditorId = existingAssignment.editor_id;

      await existingAssignment.update({
        editor_id,
        assigned_by: user.id,
      });

      // ❌ remove old editor from chat
      await ChatParticipant.update(
        { is_active: false },
        {
          where: {
            chat_room_id: chatRoom.id,
            user_id: oldEditorId,
            role: participantRoles.EDITOR,
          },
        },
      );

      // ✅ add new editor if not exists
      const existingParticipant = await ChatParticipant.findOne({
        where: {
          chat_room_id: chatRoom.id,
          user_id: editor_id,
        },
      });

      if (!existingParticipant) {
        await ChatParticipant.create({
          chat_room_id: chatRoom.id,
          user_id: editor_id,
          role: participantRoles.EDITOR,
        });
      } else {
        // if exists but inactive → reactivate
        await existingParticipant.update({ is_active: true });
      }

      return "Editor updated successfully for this book";
    }

    // =========================
    // 🆕 NEW ASSIGNMENT
    // =========================
    await AssignBookEditor.create({
      book_id,
      editor_id,
      assigned_by: user.id,
    });

    const existingParticipant = await ChatParticipant.findOne({
      where: {
        chat_room_id: chatRoom.id,
        user_id: editor_id,
      },
    });

    if (!existingParticipant) {
      await ChatParticipant.create({
        chat_room_id: chatRoom.id,
        user_id: editor_id,
        role: participantRoles.EDITOR,
      });
    } else {
      await existingParticipant.update({ is_active: true });
    }

    return "Editor assigned successfully";
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const createUserWithCredentials = async (body) => {
  const t = await sequelize.transaction();
  try {
    const { name, email, password } = body;

    if (!name?.trim() || !email || !password) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Name, email and password are required",
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    const existingUser = await User.findOne({
      where: { email: normalizedEmail, is_active: true, role_id: config.USR_ROLE_ID },
      transaction: t,
    });

    if (existingUser) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "User with this email already exists",
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create(
      {
        email: normalizedEmail,
        password: hashedPassword,
        status: "ACCEPTED",
        is_active: true,
        role_id: config.USR_ROLE_ID,
      },
      { transaction: t },
    );

    // Save the name in the profile table (this is what user_profile.name reads)
    await Profile.create(
      {
        user_id: newUser.id,
        name: trimmedName,
      },
      { transaction: t },
    );

    await t.commit();

    // Send email after commit, so a mail failure doesn't roll back the user
    try {
      await sendUserCredentials(normalizedEmail, password);
    } catch (mailErr) {
      console.error("Credentials email failed:", mailErr.message);
    }

    return {
      id: newUser.id,
      name: trimmedName,
      email: newUser.email,
      status: newUser.status,
      is_active: newUser.is_active,
    };
  } catch (error) {
    if (!t.finished) await t.rollback();
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllUsers = async (body, query) => {
  try {
    const { userId } = query;

    if (userId) {
      filter["id"] = userId;
    }

    let filter = {
      status: "ACCEPTED",
      is_active: true,
    };

    const usersDoc = await User.findAll({
      where: filter,
      attributes: [
        "id",
        "email",
        "total_credit",
        "role_id",
        "status",
        "is_active",
        "created_at",

        // ⭐ Subquery to count manuscripts (books)
        [
          Sequelize.literal(`(
            SELECT COUNT(*) 
            FROM books AS b 
            WHERE b.user_id = User.id
          )`),
          "manuscript_count",
        ],
      ],

      include: [
        {
          model: Profile,
          as: "user_profile",
          attributes: ["id", "name", "mobile", "is_active", "created_at"],
        },
        {
          model: UserAttachment,
          as: "user_attachments",
          attributes: [
            "id",
            "title",
            "file_type",
            "file_name",
            "file_uri",
            "role_id",
          ],
          where: { title: "Profile Image" },
          required: false,
          limit: 1,
        },
      ],

      order: [["created_at", "DESC"]],
    });

    return usersDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getUserDetails = async (params) => {
  try {
    const { userId } = params;
    if (!userId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Please provide userId");
    }
    let filter = { is_active: 1, id: userId };

    const usersDoc = await User.findOne({
      where: filter,
      attributes: [
        "id",
        "email",
        "role_id",
        "total_credit",
        "status",
        "is_active",
        "created_at",
        [Sequelize.fn("COUNT", Sequelize.col("user_books.id")), "total_books"],
      ],
      include: [
        {
          model: Profile,
          as: "user_profile",
          attributes: ["id", "name", "mobile", "is_active", "created_at"],
        },
        {
          model: UserAttachment,
          as: "user_attachments",
          attributes: [
            "id",
            "title",
            "file_type",
            "file_name",
            "file_uri",
            "role_id",
          ],
          where: { title: "Profile Image" },
          required: false,
          limit: 1,
        },
        {
          model: Book,
          as: "user_books",
          required: false,
          include: [
            {
              model: Genre,
              as: "book_genre",
              attributes: ["id", "title"],
            },
          ],
        },
      ],
      group: ["User.id"],
      order: [["created_at", "DESC"]],
    });

    return usersDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllEditQueueData = async (body) => {
  try {
    const { user } = body;
    let where = {};
    if (user.role_id !== config.SUP_ADM_ROLE_ID) {
      where["editor_id"] = user.id;
    }
    let include = [
      {
        model: Profile,
        as: "user_profile",
        attributes: [
          "id",
          "name",
          "mobile",
          "is_active",
          "created_at",
          "overall_ratings",
          "no_of_user_rated",
          "no_of_user_reviewed",
        ],
      },
      {
        model: UserAttachment,
        as: "user_attachments",
        attributes: [
          "id",
          "title",
          "file_type",
          "file_name",
          "file_uri",
          "role_id",
        ],
        where: { title: "Profile Image" },
        order: [["id", "desc"]],
        limit: 1,
      },
    ];
    let filter = { is_active: 1, status: bookStatus.in_editing };

    const booksDoc = await Book.findAll({
      where: filter,
      include: [
        {
          model: Genre,
          as: "book_genre",
          attributes: ["id", "title"],
        },
        {
          model: User,
          as: "book_user",
          attributes: ["id", "email", "role_id", "status", "is_active"],
          include: include,
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
          where: where,
          required: user.role_id !== config.SUP_ADM_ROLE_ID ? true : false,
          include: [
            {
              model: Admin,
              as: "editor",
              attributes: [
                "id",
                "name",
                "email",
                "role_id",
                "department_id",
                "is_active",
              ],
              include: [
                {
                  model: Role,
                  as: "admin_role",
                  attributes: ["id", "name", "abbreviation"],
                },
                {
                  model: Department,
                  as: "admin_department",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        },
      ],
      orderBy: [["created_at", "DESC"]],
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
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getUserStats = async () => {
  try {
    const totalUsers = await User.count();

    const activeUsers = await User.count({
      where: { status: "ACCEPTED" },
    });

    const inactiveUsers = await User.count({
      where: { status: "REJECTED" },
    });

    const totalManuscripts = await Book.count({
      where: { is_active: 1 },
    });

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalManuscripts,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getEditorStats = async () => {
  try {
    const activeEditors = await Admin.count({
      where: { is_active: 1 },
    });

    const superAdmins = await Admin.count({
      where: { role_id: config.SUP_ADM_ROLE_ID, is_active: 1 },
    });

    const seniorEditors = await Admin.count({
      where: { role_id: config.SENIOR_EDITOR_ROLE_ID, is_active: 1 },
    });

    const assistantEditors = await Admin.count({
      where: { role_id: config.ASSISTANT_EDITOR_ROLE_ID, is_active: 1 },
    });

    return {
      activeEditors,
      superAdmins,
      seniorEditors,
      assistantEditors,
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateUserStatus = async (reqBody) => {
  const { userId, status } = reqBody;

  if (!userId || !status) {
    throw new ApiError(400, "userId and status are required.");
  }

  const user = await User.findOne({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");

  let isActive = true;
  let userStatus = userStatusTypes.ACCEPTED;

  if (status === "active") {
    isActive = true;
    userStatus = userStatusTypes.ACCEPTED;
  } else if (status === "deactive") {
    isActive = false;
    userStatus = userStatusTypes.REJECTED;
  } else {
    throw new ApiError(
      400,
      "Invalid status value. Use 'active' or 'deactive'.",
    );
  }

  await user.update({
    is_active: isActive,
    status: userStatus,
  });

  return {
    message: `User account has been ${status === "active" ? "activated" : "deactivated"} successfully.`,
  };
};

const updateEditorStatus = async (reqBody) => {
  const { editorId, status, user } = reqBody;

  if (!editorId || !status) {
    throw new ApiError(400, "editorId and status are required.");
  }

  if (String(editorId) === String(user.id)) {
    throw new ApiError(400, "You cannot change the status of your own account.");
  }

  const editor = await Admin.findOne({ where: { id: editorId } });
  if (!editor) throw new ApiError(404, "Editor not found");

  let isActive = true;

  if (status === "active") {
    isActive = true;
  } else if (status === "deactive") {
    isActive = false;
  } else {
    throw new ApiError(
      400,
      "Invalid status value. Use 'active' or 'deactive'.",
    );
  }

  await editor.update({
    is_active: isActive,
  });

  return {
    success: true,
    message: `Editor has been ${status === "active" ? "activated" : "deactivated"} successfully.`,
  };
};

const bookDeliver = async (body, files) => {
  try {
    const { user, book_id, editor_notes } = body;

    if (!book_id || !editor_notes) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required field: book_id, editor_notes",
      );
    }

    const bookDoc = await Book.findOne({
      where: {
        id: book_id,
        is_active: 1,
      },
    });
    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Book details not found");
    }
    await assertCanEditBook(user, book_id);
    bookDoc.status = "completed";
    bookDoc.editor_notes = editor_notes;

    if (files && files.docs && files.docs[0]) {
      bookDoc.editor_submission_file_name = files.docs[0]?.filename || null;
      bookDoc.editor_submission_file_type = files.docs[0]?.mimetype || null;
    }
    await bookDoc.save();
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
    const {
      user,
      title,
      description,
      genre_id,
      cover_img_name,
      book_id,
      author,
    } = body;
    if (!book_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required fields: book_id",
      );
    }

    const bookDoc = await Book.findOne({ where: { id: book_id, is_active: 1 } });
    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "No book found");
    }
    await assertCanEditBook(user, book_id);

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

    await bookDoc.update(updateData);
    return bookDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateChapter = async (body) => {
  try {
    const { user, title, book_id, content, chapter_id } = body;
    if (!book_id || !chapter_id) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required fields: book_id, chapter_id",
      );
    }

    // The chapter must belong to the given book (chapters cannot be moved between books)
    const chapterDoc = await Chapter.findOne({
      where: { id: chapter_id, book_id, is_active: 1 },
    });
    if (!chapterDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Chapter not found or no changes made");
    }
    await assertCanEditBook(user, book_id);

    const chapterObj = {};
    if (title) {
      chapterObj["title"] = title;
    }
    if (content) {
      chapterObj["content"] = content;
      chapterObj["word_count"] = content.trim().split(/\s+/).length;
    }

    await sequelize.transaction(async (transaction) => {
      await chapterDoc.update(chapterObj, { transaction });
      const wordCount = await Chapter.sum("word_count", { where: { book_id }, transaction });
      await Book.update({ word_count: wordCount || 0 }, { where: { id: book_id }, transaction });
    });

    return await Chapter.findByPk(chapter_id);
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllPayments = async (body, query) => {
  try {
    const { user } = body;
    if (user.role_id !== config.SUP_ADM_ROLE_ID) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "You are not authorized to call this route",
      );
    }
    const { user_id } = query;
    const where = { is_active: true };
    if (user_id) {
      where["user_id"] = user_id;
    }
    const paymentDocs = await Payment.findAll({
      where: where,
    });
    if (!paymentDocs) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to fetch payments list",
      );
    }

    return paymentDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getPaymentDetails = async (body) => {
  try {
    const { payment_id, user } = body;
    if (user.role_id !== config.SUP_ADM_ROLE_ID) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "You are not authorized to call this route",
      );
    }

    if (!payment_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Please provide payment_id");
    }

    const paymentDoc = await Payment.findOne({
      where: { is_active: true, id: payment_id },
    });
    if (!paymentDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Payment details not found");
    }

    return paymentDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const adjustUserCredit = async (body) => {
  try {
    const { user, credit, user_id, action } = body;

    // Validate required fields
    if (!user_id || credit === undefined || !action) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Required fields: user_id, credit, action (add/reduce)"
      );
    }

    // Only admin access
    if (!user || user.role_id !== config.SUP_ADM_ROLE_ID) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Only admin can access this route"
      );
    }

    // Find user
    const userDoc = await User.findOne({
      where: { id: user_id },
    });

    if (!userDoc) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid user_id"
      );
    }

    const creditNumber = Number(credit);

    if (isNaN(creditNumber) || creditNumber <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Credit must be a positive number"
      );
    }

    const currentCredit = Number(userDoc.total_credit || 0);

    let updatedCredit;

    if (action === "add") {
      updatedCredit = currentCredit + creditNumber;
    } else if (action === "reduce") {
      updatedCredit = currentCredit - creditNumber;

      if (updatedCredit < 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Insufficient credits to deduct"
        );
      }
    } else {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid action. Use 'add' or 'reduce'"
      );
    }

    // Update user credits
    await User.update(
      {
        total_credit: updatedCredit,
      },
      {
        where: { id: user_id },
      }
    );

    // Save transaction history
    await UserCreditTransaction.create({
      user_id,
      admin_id: user.id,
      transaction_type: action === "add" ? "ADD" : "REDUCE",
      credits: creditNumber,
      balance_before: currentCredit,
      balance_after: updatedCredit,
      description: `Admin ${action}ed ${creditNumber} credits`,
    });

    const latest = await User.findByPk(user_id);

    return {
      message: `Successfully ${
        action === "add" ? "added" : "deducted"
      } ${creditNumber} credits`,
      total_credit: Number(latest.total_credit),
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message || "Something went wrong"
    );
  }
};

const adminBookSubmissionAction = async (body) => {
  const transaction = await sequelize.transaction();

  try {
    const { book_id, status } = body;

    if (!book_id || !status) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "book_id and status are required",
      );
    }

    const allowedStatus = ["feedback"];
    if (!allowedStatus.includes(status)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status");
    }

    // ---------------- BOOK CHECK ----------------
    const bookDoc = await Book.findOne({
      where: { id: book_id, is_active: 1 },
      transaction,
    });

    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Book not found");
    }
    await assertCanEditBook(body.user, book_id);

    // ✅ Only allow transition from in-editing → feedback
    if (bookDoc.status !== "in-editing") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Book must be in-editing to move to feedback",
      );
    }

    // ---------------- UPDATE ----------------
    await bookDoc.update({ status: "feedback" }, { transaction });

    await transaction.commit();

    return {
      book_id,
      status: "feedback",
    };
  } catch (error) {
    await transaction.rollback();
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllPendingSubmissions = async (body) => {
  try {
    const bookSubmissionRequestDocs = await BookSubmissionRequest.findAll({
      where: { status: "pending" },
      order: [["created_at", "DESC"]],
      include: [
        {
          model: Book,
          as: "submission_book",
        },
      ],
    });
    if (!bookSubmissionRequestDocs) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No pending submission found");
    }
    return bookSubmissionRequestDocs;
  } catch (error) {
    await transaction.rollback();
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteUserById = async (userId) => {
  try {
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    await user.update({
      is_active: false,
      status: "PENDING",
      deleted_at: new Date(),
    });

    return { message: "User deleted successfully" };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteEditorById = async (editorId, user) => {
  try {
    if (String(editorId) === String(user.id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "You cannot delete your own account");
    }
    const editor = await Admin.findOne({
      where: { id: editorId, is_active: 1 },
    });

    if (!editor) {
      throw new ApiError(httpStatus.NOT_FOUND, "Editor not found");
    }

    await editor.update({
      is_active: 0,
      deleted_at: new Date(),
    });

    return { message: "Editor deleted successfully" };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
  getAllBooks,
  getBookDetails,
  getAllEditors,
  assignBookToEditor,
  getAllUsers,
  createUserWithCredentials,
  getUserDetails,
  getAllEditQueueData,
  getUserStats,
  getEditorStats,
  updateUserStatus,
  updateEditorStatus,
  bookDeliver,
  updateBook,
  updateChapter,
  getAllPayments,
  getPaymentDetails,
  adjustUserCredit,
  adminBookSubmissionAction,
  getAllPendingSubmissions,
  deleteUserById,
  deleteEditorById,
};
