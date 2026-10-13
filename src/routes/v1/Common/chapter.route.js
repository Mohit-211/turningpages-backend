/** @format */

const express = require("express");
const router = express.Router();

const { Op } = require("sequelize");

const { chapterController } = require("../../../controllers");
const {
  userAuthMiddleware,
  adminAuthMiddleware,
  anyAuthMiddleware,
} = require("../../../middlewares");
const { Chapter, Book, Genre, User, UserCreditSpending } = require("../../../models");
const {
  systemInstructionForChapter,
  ai,
  ThinkingLevel,
  extractFinalImage,
} = require("../../../config/geminiConfig");
const responseWrapper = require("../../../config/responseWrapper");
const { status: httpStatus } = require("http-status");
const path = require("path");
const fs = require("fs");
const sequelize = require("../../../config/central.db");
const config = require("../../../config/config");

// Characters of the current chapter text included in the generation prompt (about 3k tokens)
const CURRENT_TEXT_MAX_CHARS = 12000;

router.post(
  "/",
  [userAuthMiddleware.verifyAuthJWTToken],
  chapterController.createChapter,
);
router.get(
  "/:chapterId",
  [userAuthMiddleware.verifyAuthJWTToken],
  chapterController.getChapterById,
);
router.patch(
  "/",
  [userAuthMiddleware.verifyAuthJWTToken],
  chapterController.updateChapter,
);
router.post(
  "/remove",
  [userAuthMiddleware.verifyAuthJWTToken],
  chapterController.removeChapter,
);

const generateChapterContent = async (req, res) => {
  let transaction;
  try {
    const { user } = req.body;
    const { chapter_id, instruction = "", words_count = 1000, context = "" } = req.body;

    if (!chapter_id || !instruction?.trim()) {
      return responseWrapper(
        res,
        null,
        "chapter_id and instruction are required.",
        httpStatus.BAD_REQUEST,
      );
    }

    const chapterDoc = await Chapter.findOne({
      where: { id: chapter_id },
      attributes: ["id", "title", "description", "content", "book_id"],
    });

    if (!chapterDoc)
      return responseWrapper(
        res,
        null,
        "Chapter not found.",
        httpStatus.BAD_REQUEST,
      );

    // The chapter's book must belong to the caller
    const bookDoc = await Book.findOne({
      where: { id: chapterDoc.book_id, user_id: user.id, is_active: 1 },
      attributes: ["id", "title", "description", "genre_id"],
      include: [{ model: Genre, as: "book_genre", attributes: ["title"] }],
    });

    if (!bookDoc)
      return responseWrapper(
        res,
        null,
        "Book not found.",
        httpStatus.BAD_REQUEST,
      );

    // ==================== CREDIT DEDUCTION ====================
    // Opened only after validation so early returns never leave a transaction open
    transaction = await sequelize.transaction();

    const userDoc = await User.findByPk(user.id, { transaction });

    if (!userDoc || Number(userDoc.total_credit) < 0.25) {
      await transaction.rollback();
      return responseWrapper(
        res,
        null,
        "Insufficient credits.",
        httpStatus.BAD_REQUEST,
      );
    }

    const remainingCredit = Number(userDoc.total_credit) - 0.25;

    await userDoc.decrement("total_credit", {
      by: 0.25,
      transaction,
    });

    await UserCreditSpending.create(
      {
        user_id: user.id,
        credit_spent: 0.25,
        remaining_credit: remainingCredit,
        event_name: "generate_chapter_content",
      },
      { transaction },
    );

    const genreName = bookDoc.book_genre?.title || "Fiction";

    const previousChapters = await Chapter.findAll({
      where: { book_id: chapterDoc.book_id, id: { [Op.lt]: chapter_id } },
      order: [["id", "DESC"]],
      limit: 2,
      attributes: ["title", "description", "content"],
    });

    let contextText = "";
    if (bookDoc.description?.trim()) {
      contextText += `### BOOK DESCRIPTION\n${bookDoc.description}\n\n`;
    }
    if (previousChapters.length > 0) {
      contextText += `### PREVIOUS CHAPTERS - MAINTAIN STRICT CONTINUITY\n`;
      previousChapters.forEach((ch, i) => {
        const chapNo = previousChapters.length - i;
        contextText += `\n--- Chapter ${chapNo}: ${ch.title} ---\n`;
        if (ch.description?.trim())
          contextText += `Chapter Note: ${ch.description}\n`;
        if (ch.content) contextText += ch.content.substring(0, 1500) + "...\n";
      });
    } else {
      contextText += `### THIS IS THE FIRST CHAPTER\n`;
    }

    // The AI continues from the editor's current text (sent as `context`, possibly unsaved),
    // falling back to the saved chapter. Only the end is sent, to keep the prompt bounded.
    const currentText = String(context || chapterDoc.content || "")
      .replace(/<[^>]*>/g, " ")
      .trim();
    if (currentText) {
      contextText += `\n### CURRENT CHAPTER SO FAR (continue from where this ends)\n${currentText.slice(-CURRENT_TEXT_MAX_CHARS)}\n`;
    }

    // ==================== FINAL UNIVERSAL PROMPT ====================
    const basePrompt = `
You are a professional author writing a high-quality ${genreName} book.

### BOOK DETAILS
Title: ${bookDoc.title}
Genre: ${genreName}
${bookDoc.description ? `Book Description: ${bookDoc.description}` : ""}

### CURRENT CHAPTER
Title: ${chapterDoc.title}

### CONTEXT - MAINTAIN STRICT CONTINUITY
${contextText}

### USER INSTRUCTION (FOLLOW EXACTLY)
${instruction}

### STRICT RULES - OBEY WITHOUT EXCEPTION
- Write in plain, clear, direct, and restrained prose.
- Write with clear, direct, and natural sentence flow. Keep the prose restrained and easy to understand.
- Completely forbid purple prose, metaphors, similes, and poetic language.
- Never write phrases like: "dust of forgotten letters", "past reached out", "heavy with burden", "landscape of his understanding", "silence was heavy", "heart lurched", "shimmered in the light", etc.
- Focus on concrete actions, observations, dialogue, explanations, and procedural detail depending on the genre.
- Avoid cinematic or overly dramatic emotional narration.
- For Mystery genre: Focus on realism, quiet tension, and factual description.
- Break content into clear, readable paragraphs. Most paragraphs should be between 3–6 sentences unless the scene or explanation requires otherwise.
- Avoid repetitive sentence openings and repetitive phrasing.
- Avoid filler content and unnecessary repetition.
- Maintain strict continuity for injuries, timelines, locations, evidence, and character knowledge.
- Do not include markdown headings, chapter titles, labels, or formatting symbols like #, ##, ###, *, or bullet points unless explicitly requested.
- Trust subtext and observable behavior instead of overexplaining.
- If CURRENT CHAPTER SO FAR is given, continue from where it ends. Do not repeat or rewrite it.

- Output only the chapter content. Nothing else.

Write at least ${words_count} words. Do not stop early. Keep writing until you clearly reach ${words_count} words.
`;

    // Gemini 3 is tuned for its default temperature (1.0); lower values can cause repetition and looping.
    // Low thinking keeps latency and cost down for long-form writing.
    const response = await ai.models.generateContentStream({
      model: config.models.geminiText,
      contents: basePrompt,
      config: {
        systemInstruction: systemInstructionForChapter,
        maxOutputTokens: 16000,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    // SSE. "no-transform" stops the compression middleware from buffering events, and
    // X-Accel-Buffering stops nginx from buffering them.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let finalReply = "";

    for await (const chunk of response) {
      const delta = chunk.text;
      if (delta) {
        finalReply += delta;
        res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
      }
    }

    // The reply is not saved to the chapter: the app inserts it into the editor and saves
    // through PATCH /chapters. The credit is charged once a non-empty reply is delivered.
    if (finalReply.trim()) {
      await transaction.commit();
      transaction = null;

      res.write(
        `data: ${JSON.stringify({ type: "final", token: finalReply })}\n\n`,
      );
    } else {
      await transaction.rollback();
      transaction = null;
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error("Chapter generation error:", error.message);
    if (!res.headersSent) {
      return responseWrapper(
        res,
        null,
        "Failed to generate chapter content.",
        httpStatus.INTERNAL_SERVER_ERROR,
      );
    } else {
      res.write(
        `data: ${JSON.stringify({ type: "error", token: "Sorry, I am unable to process your query!" })}\n\n`,
      );
      res.end();
    }
  }
};

// Aspect ratios accepted by the Gemini image models
const COVER_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];

// A "WIDTHxHEIGHT" size picks the closest supported ratio; otherwise the direction decides (portrait 2:3 by default)
const coverAspectRatio = (size, direction) => {
  const match = /^(\d+)\s*x\s*(\d+)$/i.exec(String(size));
  if (match && Number(match[2]) > 0) {
    const target = Number(match[1]) / Number(match[2]);
    return COVER_ASPECT_RATIOS.reduce((best, ratio) => {
      const [w, h] = ratio.split(":").map(Number);
      const [bw, bh] = best.split(":").map(Number);
      return Math.abs(w / h - target) < Math.abs(bw / bh - target) ? ratio : best;
    });
  }
  if (direction === "horizontal") return "3:2";
  if (direction === "square") return "1:1";
  return "2:3";
};

const generateBookCover = async (req, res) => {
  try {
    const {
      user,
      title,
      genre,
      description = "",
      size = "1024x1536",
      direction = "vertical",
      author = "Turning Page",
    } = req.body;

    if (!title || !genre || !size || !direction || !author) {
      return responseWrapper(
        res,
        null,
        "Please provide required fields: title, genre, size, direction, author.",
        httpStatus.BAD_REQUEST,
      );
    }

    const prompt = `
Generate a high-quality, professional book cover.

STRICT TEXT REQUIREMENTS (VERY IMPORTANT):
- Title must appear EXACTLY as: "${title}"
- Author name must appear EXACTLY as: "${author}"
- Do NOT change spelling, capitalization, or formatting.
- Preserve uppercase/lowercase exactly as given.

Book Details:
- Genre: ${genre}
- Orientation: ${direction}
- Size: ${size}

${
  description
    ? `User Creative Direction:
- ${description}`
    : ""
}

Design Instructions:
- Make the typography clean and readable
- Place title prominently
- Place author name clearly at bottom or top
- Match visual theme to genre
${
  description
    ? "- STRICTLY follow the user's creative direction above"
    : "- Use your own creative judgment for visuals"
}
- Use cinematic, professional composition

Return ONLY the final image.
`;

    const response = await ai.models.generateContent({
      model: config.models.geminiImage,
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: coverAspectRatio(size, direction),
          imageSize: config.geminiImageSize,
        },
      },
    });

    const image = extractFinalImage(response);
    if (!image) {
      return responseWrapper(
        res,
        null,
        "The image model did not return a cover. Please try again.",
        httpStatus.BAD_GATEWAY,
      );
    }

    const extension = { "image/jpeg": "jpg", "image/webp": "webp" }[image.mimeType] || "png";
    const fileName = `book_cover_${Date.now()}.${extension}`;
    const filePath = path.join(config.STORAGE_DIR, "images", fileName);
    fs.writeFileSync(filePath, Buffer.from(image.data, "base64"));

    return res.status(200).json({
      success: true,
      message: "Book cover generated successfully.",
      fileName,
    });
  } catch (error) {
    console.error("Error generating book cover:", error.message);
    return responseWrapper(
      res,
      null,
      "Failed to generate book cover image.",
      httpStatus.INTERNAL_SERVER_ERROR,
    );
  }
};

router.post(
  "/generate/chapter/content",
  [userAuthMiddleware.verifyAuthJWTToken],
  generateChapterContent,
);

router.post("/generate/cover", [anyAuthMiddleware.verifyUserOrAdmin], generateBookCover);

router.post("/cover/remove/:id", [anyAuthMiddleware.verifyUserOrAdmin], chapterController.removeBookCover);

// chat assistant routes
router.post(
  "/assistant/chat",
  [userAuthMiddleware.verifyAuthJWTToken],
  chapterController.chatWithAssistant,
);
router.post(
  "/conversation/create",
  [userAuthMiddleware.verifyAuthJWTToken],
  chapterController.createConversation,
);
router.get(
  "/conversation/messages/:id",
  [userAuthMiddleware.verifyAuthJWTToken],
  chapterController.getConversationMessages,
);
router.get(
  "/conversation/list",
  [userAuthMiddleware.verifyAuthJWTToken],
  chapterController.getConversationList,
);

// admin apis

router.post("/create/admin", [adminAuthMiddleware.validateJWTtoken], chapterController.createChapterAdmin);
router.patch("/update/admin", [adminAuthMiddleware.validateJWTtoken], chapterController.updateChapterAdmin);
router.delete("/remove/admin/:id", [adminAuthMiddleware.validateJWTtoken], chapterController.removeChapterAdmin);

module.exports = router;
