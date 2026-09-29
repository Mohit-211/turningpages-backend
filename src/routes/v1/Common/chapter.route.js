/** @format */

const express = require("express");
const router = express.Router();

const { Op } = require("sequelize");

const { chapterController } = require("../../../controllers");
const { userAuthMiddleware } = require("../../../middlewares");
const { Chapter, Book, Genre, User, UserCreditSpending } = require("../../../models");
const {
  systemInstructionForChapter,
  ai,
  systemInstructionForCoverImage,
} = require("../../../config/gemeniConfig");
const responseWrapper = require("../../../config/responseWrapper");
const httpStatus = require("http-status");
const path = require("path");
const fs = require("fs");
const { CLIENT_RENEG_LIMIT } = require("tls");
const sequelize = require("../../../config/central.db");
const config = require("../../../config/config");

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
    transaction = await sequelize.transaction();
    const { chapter_id, instruction = "", words_count = 1000 } = req.body;

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

    const bookDoc = await Book.findByPk(chapterDoc.book_id, {
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

    console.log("req.user:", req.user);
    console.log("req.body:", req.body);

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
    const genreLower = genreName.toLowerCase();

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

- Output only the chapter content. Nothing else.

Write at least ${words_count} words. Do not stop early. Keep writing until you clearly reach ${words_count} words.
`;

    // Temperature
    const temperature =
      genreLower.includes("mystery") ||
      genreLower.includes("thriller") ||
      genreLower.includes("non-fiction")
        ? 0.55
        : 0.75;

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: basePrompt,
      config: {
        systemInstruction: systemInstructionForChapter,
        temperature: temperature,
        topP: 0.85,
        maxOutputTokens: 16000,
      },
    });

    // SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let finalReply = "";

    for await (const chunk of response) {
      const delta = chunk.text;
      if (delta) {
        finalReply += delta;
        res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
      }
    }

    if (finalReply.trim()) {
      const actualWords = finalReply.split(/\s+/).length;

      await chapterDoc.update({
        content: finalReply,
        word_count: actualWords,
      });

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
    console.error("Chapter generation error:", error);
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

// const generateChapterContent = async (req, res) => {
//   try {
//     const {
//       chapter_id,
//       instruction = "",
//       context = "", // ✅ user can pass
//       words_count = 1000,
//     } = req.body;

//     if (!chapter_id || !instruction) {
//       return responseWrapper(
//         res,
//         null,
//         "Please provide required fields: chapter_id, instruction.",
//         httpStatus.BAD_REQUEST,
//       );
//     }

//     // 🔹 Get chapter
//     const chapterDoc = await Chapter.findOne({ where: { id: chapter_id } });
//     if (!chapterDoc) {
//       return responseWrapper(res, null, "Chapter not found.", httpStatus.BAD_REQUEST);
//     }

//     // 🔹 Get book (for genre)
//     const bookDoc = await Book.findByPk(chapterDoc.book_id);
//     if (!bookDoc) {
//       return responseWrapper(res, null, "Book not found.", httpStatus.BAD_REQUEST);
//     }

//     // 🔹 Get previous chapter
//     const lastChapter = await Chapter.findOne({
//       where: {
//         book_id: chapterDoc.book_id,
//         id: { [Op.lt]: chapter_id },
//       },
//       order: [["id", "DESC"]],
//     });

//     // ✅ CONTEXT PRIORITY LOGIC
//     let finalContext = "";

//     if (context && context.trim()) {
//       finalContext = context;
//     } else if (lastChapter?.content) {
//       finalContext = lastChapter.content;
//     } else {
//       finalContext = `
// This is the beginning of the story.
// Introduce the main character, setting, and tone naturally.
// `;
//     }

//     // 🔥 FINAL PROMPT
//     const basePrompt = `
// You are a professional fiction author writing a novel.

// ### BOOK DETAILS
// Title: ${bookDoc.title}
// Genre: ${bookDoc.genre}

// ### CURRENT CHAPTER
// Chapter Title: ${chapterDoc.title}

// ### CONTEXT
// ${finalContext}

// ### WRITING INSTRUCTION (IMPORTANT - FOLLOW THIS STRICTLY)
// ${instruction}

// ### RULES
// - Follow the genre strictly (${bookDoc.genre})
// - Maintain continuity with the context
// - Use immersive storytelling (no summaries)
// - Include dialogue where appropriate
// - Show emotions, don’t just tell
// - Keep characters consistent
// - Avoid repetition
// - Do NOT explain the story — write it

// ### OUTPUT
// Write approximately ${words_count} words of high-quality story content.
// `;

//     // 🔹 Gemini call
//     const response = await ai.models.generateContentStream({
//       model: "gemini-2.5-flash",
//       contents: basePrompt,
//       config: {
//         thinkingBudget: 0,
//         systemInstruction: systemInstructionForChapter,
//         temperature: 0.9,
//         topP: 0.9,
//       },
//     });

//     let finalReply = "";

//     // 🔹 SSE setup
//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.flushHeaders();

//     for await (const chunk of response) {
//       const delta = chunk.text;

//       if (delta) {
//         finalReply += delta;

//         res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
//       }
//     }

//     console.log("\n===== FINAL OUTPUT =====\n", finalReply);

//     // 🔹 Save content
//     if (finalReply) {
//       await chapterDoc.update({ content: finalReply });

//       res.write(
//         `data: ${JSON.stringify({ type: "final", token: finalReply })}\n\n`,
//       );
//     }

//     res.write(`data: [DONE]\n\n`);
//     res.end();

//   } catch (error) {
//     console.error("Error generating chapter content:", error);

//     if (!res.headersSent) {
//       return responseWrapper(
//         res,
//         null,
//         "Failed to generate chapter content.",
//         httpStatus.INTERNAL_SERVER_ERROR,
//       );
//     } else {
//       res.write(
//         `data: ${JSON.stringify({
//           type: "error",
//           token: "Sorry, I am unable to process your query!",
//         })}\n\n`,
//       );
//       res.end();
//     }
//   }
// };

// const generateChapterContent = async (req, res) => {
//   try {
//     const {
//       user,
//       chapter_id,
//       instruction = "",
//       words_count = 1000,
//       context = "",
//     } = req.body;

//     if (!chapter_id || !instruction) {
//       return responseWrapper(
//         res,
//         null,
//         "Please provide required fields: title, book_id, chapter_id, instruction.",
//         httpStatus.BAD_REQUEST,
//       );
//     }

//     const chapterDoc = await Chapter.findOne({ where: { id: chapter_id } });
//     if (!chapterDoc) {
//       return responseWrapper(
//         res,
//         null,
//         "Chapter not found.",
//         httpStatus.BAD_REQUEST,
//       );
//     }

//     const basePrompt = `
//             You are a professional book writer.
//             Current chapter title: ${chapterDoc.title}
//             For each section, write content that is:
//                 - Human - like and emotionally engaging
//                 - Logically flowing and coherent
//                 - Around { words_per_section } words
//                 - Consistent with previous sections and context(if provided)
//                 - Includes rich descriptions, dialogues, or character thoughts if relevant
//             ${
//               context
//                 ? `Previous context from earlier writing:\n${context}\n`
//                 : "No prior context provided. This is a fresh start."
//             }
//             User's writing instruction: ${instruction || "Continue naturally."}
//             Please write approximately ${words_count} words of new, high-quality book content
//             that feels human-written, emotionally engaging, and professionally structured.
//             Maintain logical flow, continuity, and narrative consistency.
//         `;

//     const response = await ai.models.generateContentStream({
//       model: "gemini-2.5-flash", // gemini-2.5-pro
//       contents: basePrompt,
//       config: {
//         thinkingBudget: 0,
//         systemInstruction: systemInstructionForChapter,
//         temperature: 0.8,
//         topP: 0.9,
//       },
//     });

//     let finalReply = "";
//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");
//     res.flushHeaders();
//     for await (const chunk of response) {
//       let delta = chunk.text;

//       if (delta) {
//         finalReply += delta;

//         console.log(delta);

//         res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
//       }
//     }
//     console.log("\n\n===== FINAL OUTPUT =====\n");
//     console.log(finalReply);
//     if (finalReply) {
//       res.write(
//         `data: ${JSON.stringify({ type: "final", token: finalReply })}\n\n`,
//       );
//     }

//     res.write(`data: [DONE]\n\n`);
//     res.end();
//   } catch (error) {
//     console.error("Error generating chapter content:", error);
//     if (!res.headersSent) {
//       return responseWrapper(
//         res,
//         null,
//         "Failed to generate chapter content.",
//         httpStatus.INTERNAL_SERVER_ERROR,
//       );
//     } else {
//       res.write(
//         `data: ${JSON.stringify({ type: "error", token: "Sorry, I am unable to process your query!" })}\n\n`,
//       );
//       res.end();
//     }
//   }
// };

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
      model: "gemini-2.5-flash-image", // works for images
      contents: prompt,
      // config: {
      //     systemInstruction: systemInstructionForCoverImage,
      // },
      // size: size
    });
    const base64Image = response.data;
    const buffer = Buffer.from(base64Image, "base64");
    const fileName = `book_cover_${Date.now()}.png`;
    const filePath = path.join(config.STORAGE_DIR, "images", fileName);
    fs.writeFileSync(filePath, buffer);

    return res.status(200).json({
      success: true,
      message: "Book cover generated successfully.",
      fileName,
      // https://api.turningpages.io:9090/images/book_cover_1765433209487.png
    });
  } catch (error) {
    console.error("Error generating book cover:", error);
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

router.post("/generate/cover", generateBookCover);

router.post("/cover/remove/:id", chapterController.removeBookCover);

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

router.post("/create/admin", chapterController.createChapterAdmin);
router.get("/:chapterId", chapterController.getChapterByIdAdmin);
router.patch("/update/admin", chapterController.updateChapterAdmin);
router.delete("/remove/admin/:id", chapterController.removeChapterAdmin);

module.exports = router;
