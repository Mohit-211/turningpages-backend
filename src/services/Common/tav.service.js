const { status: httpStatus } = require("http-status");
const ApiError = require("../../utils/ApiError");
const { Book, Chapter, Genre, User, Profile } = require("../../models");
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const CHUNK_SIZE = 2;

const runTavAnalysis = async (book_id) => {
  try {

    if (!book_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "book_id is required");
    }

    const bookDoc = await Book.findOne({
      where: {
        id: book_id,
        is_active: 1,
      },
      include: [
        {
          model: Genre,
          as: "book_genre",
          attributes: ["id", "title"],
        },
        {
          model: User,
          as: "book_user",
          attributes: ["id"],
          include: [
            {
              model: Profile,
              as: "user_profile",
              attributes: ["name"],
            },
          ],
        },
        {
          model: Chapter,
          as: "book_chapters",
          attributes: ["id", "title", "description", "content", "word_count"],
          order: [["id", "ASC"]],
        },
      ],
    });

    if (!bookDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Book not found");
    }

    validateBookForAnalysis(bookDoc);

    const chapterMap = buildChapterMap(bookDoc);

    const structure = await extractStructure(chapterMap);

    const chunkAnalysis = await analyzeChapterChunks(chapterMap, structure);

    const finalReport = await generateFinalReport(
      chapterMap,
      structure,
      chunkAnalysis,
    );

    const manuscriptStatus = determineManuscriptStatus(bookDoc);

    const reportHeader = buildReportHeader(bookDoc, manuscriptStatus);

    reportHeader.certification = finalReport.scores.certification;

    reportHeader.readiness = finalReport.readiness;

    return {
      header: reportHeader,

      report: finalReport,

      chapter_analysis: chunkAnalysis,

      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const validateBookForAnalysis = (bookDoc) => {
  console.log("Validating book for TAV analysis");
  if (!bookDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, "Book not found.");
  }

  if (!bookDoc.title?.trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Book title is required.");
  }

  if (!bookDoc.description?.trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Book description is required.");
  }

  if (
    !bookDoc.book_chapters ||
    !Array.isArray(bookDoc.book_chapters) ||
    bookDoc.book_chapters.length === 0
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Book must contain at least one chapter.",
    );
  }

  if (bookDoc.word_count < 500) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Book should contain at least 500 words for TAV Analysis.",
    );
  }

  bookDoc.book_chapters.forEach((chapter, index) => {
    if (!chapter.content || !chapter.content.trim()) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Chapter "${chapter.title}" is empty. Please add content before running TAV Analysis.`,
      );
    }
  });

  return true;
};

const buildChapterMap = (bookDoc) => {
  console.log("Building chapter map for TAV analysis");
  return {
    book: {
      id: bookDoc.id,
      title: bookDoc.title,
      description: bookDoc.description,
      genre: bookDoc.book_genre?.title || "",
      language: bookDoc.language,
      author: bookDoc.book_user?.user_profile?.name || bookDoc.author || "",
      total_words: bookDoc.word_count,
      total_chapters: bookDoc.book_chapters.length,
    },

    chapters: bookDoc.book_chapters.map((chapter, index) => ({
      chapter_number: index + 1,
      chapter_id: chapter.id,
      title: chapter.title,
      description: chapter.description || "",
      word_count: chapter.word_count || 0,
      content: chapter.content,
    })),
  };
};

const extractStructure = async (chapterMap) => {
  try {
    console.log("Extracting book structure...");

    const prompt = `
You are an expert professional book editor.

Analyze ONLY the overall structure of this book.

Do NOT evaluate writing quality.
Do NOT rewrite anything.

BOOK

Title:
${chapterMap.book.title}

Genre:
${chapterMap.book.genre}

Description:
${chapterMap.book.description}

Total Chapters:
${chapterMap.book.total_chapters}

CHAPTERS

${chapterMap.chapters
  .map(
    (chapter) => `
Chapter ${chapter.chapter_number}

Title: ${chapter.title}

Word Count: ${chapter.word_count}

First 500 characters:

${chapter.content.substring(0, 500)}
`,
  )
  .join("\n")}

Return ONLY valid JSON.

{
  "audience":"",
  "book_goal":"",
  "overall_structure":"",
  "repeated_themes":[],
  "chapter_map":[
      {
        "chapter_number":1,
        "purpose":"",
        "summary":""
      }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    const text = response.text || "";

    return parseGeminiJSON(text);
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
  }
};

const parseGeminiJSON = (responseText) => {
  try {
    let cleaned = responseText.trim();

    // Remove ```json
    cleaned = cleaned.replace(/^```json/i, "");

    // Remove ```
    cleaned = cleaned.replace(/^```/, "");
    cleaned = cleaned.replace(/```$/, "");

    cleaned = cleaned.trim();

    return JSON.parse(cleaned);
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to parse Gemini response.",
    );
  }
};

const calculateTavScore = (report) => {
  const theme = Number(report.scores.theme || 0);
  const authority = Number(report.scores.authority || 0);
  const value = Number(report.scores.value || 0);

const overall = Math.round(theme + authority + value);

  const structuralAudit =
    report.sections.find((s) => s.name === "Structural Audit")?.score || 0;

  const flowTest =
    report.sections.find((s) => s.name === "Flow Test")?.score || 0;

  const redundancy =
    report.sections.find((s) => s.name === "Redundancy Check")?.score || 0;

  let certification = "Not Yet Certified";

  report.scores.theme = buildScoreObject(theme);

  report.scores.authority = buildScoreObject(authority);

  report.scores.value = buildScoreObject(value);

  report.scores.overall = overall;

  report.scores.certification = certification;

  let readiness = "";

  if (
    overall >= 27 &&
    structuralAudit >= 8 &&
    flowTest >= 8 &&
    redundancy >= 8
  ) {
    certification = "TAV Distinction";
    readiness = "Ready for Publishing";
  } else if (overall >= 24 && structuralAudit >= 7) {
    certification = "TAV Certified";
    readiness = "Needs Minor Revision";
  } else if (overall >= 20) {
    certification = "TAV Verified";
    readiness = "Needs Moderate Revision";
  } else {
    certification = "Not Yet Certified";
    readiness = "Major Revision Required";
  }
  report.readiness = readiness;
  report.overall_score = overall;

  if (Array.isArray(report.sections)) {
    report.sections = report.sections.map((section) => ({
      ...section,
      ...buildScoreObject(section.score),
    }));
  }

  report.scores.certification = certification;

  return report;
};

const buildScoreObject = (score) => {
  score = Number(score);

  let rating = "";
  let meaning = "";

  if (score >= 9) {
    rating = "Excellent";
    meaning = "Minor refinement only";
  } else if (score >= 7) {
    rating = "Strong";
    meaning = "Strong, but improvement needed";
  } else if (score >= 5) {
    rating = "Moderate";
    meaning = "Notable weaknesses";
  } else if (score >= 3) {
    rating = "Weak";
    meaning = "Major revision needed";
  } else {
    rating = "Severely Underdeveloped";
    meaning = "Extensive revision required";
  }

  return {
    score,
    rating,
    meaning,
  };
};

const determineManuscriptStatus = (bookDoc) => {
  const chapterCount = bookDoc.book_chapters.length;

  const completedChapters = bookDoc.book_chapters.filter(
    (chapter) => chapter.content && chapter.content.trim().length > 0,
  ).length;

  if (chapterCount === 0) {
    return "unknown";
  }

  if (completedChapters === chapterCount) {
    if (bookDoc.word_count >= 30000) {
      return "complete";
    }

    return "mostly_complete";
  }

  if (completedChapters > 0) {
    return "partial_draft";
  }

  return "incomplete";
};

const buildReportHeader = (bookDoc, manuscriptStatus) => {
  return {
    report_title: "TAV Analysis Report",

    certification: "",

    readiness: "",

    analysis_date: new Date().toISOString(),

    tav_version: "1.0",

    model: "gemini-2.5-flash",

    manuscript_status: manuscriptStatus,

    book: {
      id: bookDoc.id,
      title: bookDoc.title,
      author: bookDoc.book_user?.user_profile?.name || bookDoc.author || "",
      genre: bookDoc.book_genre?.title || "",
      language: bookDoc.language || "",
      total_words: bookDoc.word_count,
      total_chapters: bookDoc.book_chapters.length,
    },
  };
};

const analyzeChapterChunks = async (chapterMap, structure) => {
  try {
    console.log("Analyzing chapter chunks...");

    const chunkResults = [];

    for (let i = 0; i < chapterMap.chapters.length; i += CHUNK_SIZE) {
      const chunk = chapterMap.chapters.slice(i, i + CHUNK_SIZE);

      const result = await analyzeChunk(chunk, structure);

      chunkResults.push(result);
    }

    return chunkResults;
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
  }
};

const analyzeChunk = async (chapters, structure) => {
  console.log(
    `Analyzing Chapters ${chapters[0].chapter_number} - ${
      chapters[chapters.length - 1].chapter_number
    }`,
  );

  const prompt = `
You are a professional developmental editor.

Book Audience

${structure.audience}

Book Goal

${structure.book_goal}

Analyze ONLY these chapters.

Use the overall book structure above to determine whether each chapter fulfills its intended purpose.

Evaluate:

- Structure
- Clarity
- Flow
- Redundancy
- Purpose fulfillment

${chapters
  .map(
    (chapter) => `
Chapter ${chapter.chapter_number}

Title:
${chapter.title}

Content:

${chapter.content}
`,
  )
  .join("\n")}


  IMPORTANT SCORING RULES

All chapter scores MUST be integers between 0 and 10.

Structure: 0-10
Clarity: 0-10
Flow: 0-10
Redundancy: 0-10

Never return percentages.
Never return scores greater than 10.

Return ONLY JSON.

Return ONLY valid JSON.

{
  "chapters":[
    {
      "chapter_number":1,

      "chapter_title":"",

      "purpose":"",

      "summary":"",

      "rewrite_priority":"High",

      "scores":{
        "structure":0,
        "clarity":0,
        "flow":0,
        "redundancy":0
      },

      "strengths":[],

      "issues":[],

      "recommendations":[]
    }
  ]
}
`;
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
    },
  });

  const result = parseGeminiJSON(response.text || "");

  result.chapters = result.chapters.map((chapter) => ({
    ...chapter,
    scores: {
      structure: buildScoreObject(chapter.scores.structure),
      clarity: buildScoreObject(chapter.scores.clarity),
      flow: buildScoreObject(chapter.scores.flow),
      redundancy: buildScoreObject(chapter.scores.redundancy),
    },
  }));

  return {
    chapters: result.chapters || [],
  };
};

const generateFinalReport = async (chapterMap, structure, chunkAnalysis) => {
  try {
    console.log("Generating Final TAV Report...");

    console.log(
      "Generating final report using",
      chunkAnalysis.length,
      "chunk(s)",
    );

    const prompt = `
You are a senior developmental editor.

You have already analyzed the manuscript.

Now generate ONE FINAL TAV REPORT.

BOOK

Title:
${chapterMap.book.title}

Genre:
${chapterMap.book.genre}

Description:
${chapterMap.book.description}

STRUCTURE

${JSON.stringify(structure, null, 2)}

CHAPTER ANALYSIS

${JSON.stringify(chunkAnalysis, null, 2)}

----------------------------------------

Generate the final report.

IMPORTANT SCORING RULES

All scores in this report MUST be INTEGERS from 0 to 10.

Never return percentages.
Never return scores out of 100.
Never return values greater than 10.

Use this scale consistently:

9-10 = Excellent (minor refinement only)
7-8 = Strong (improvement needed)
5-6 = Moderate (notable weaknesses)
3-4 = Weak (major revision needed)
1-2 = Severely underdeveloped

The final TAV score is calculated by the backend:

Overall = Theme + Authority + Value

Maximum overall score = 30.

All 9 audit sections must also use scores from 0 to 10.


SECTION SCORING RULES

Each audit section MUST receive an INTEGER score from 0 to 10.

Never return percentages such as:
55
60
70
80
90

Every score must be an integer between 0 and 10.

Correct examples:

Structural Audit = 8
Flow Test = 7
Compression Pass = 9
Placement Review = 6

Return ONLY valid JSON.

{
  "executive_summary": {
    "overall_assessment": "",
    "major_strengths": [],
    "major_weaknesses": [],
    "editor_notes": ""
  },

"scores": {
    "theme": 8,
    "authority": 7,
    "value": 9
},

  "sections":[

      {
          "key":"structural_audit",
          "name":"Structural Audit",
          "score":8,
          "assessment":"",
          "strengths":[],
          "findings":[],
          "recommendations":[]
      },

      {
          "key":"chapter_purpose_audit",
          "name":"Chapter Purpose Audit",
          "score":7,
          "assessment":"",
          "strengths":[],
          "findings":[],
          "recommendations":[]
      },

      {
          "key":"redundancy_check",
          "name":"Redundancy Check",
          "score":8,
          "assessment":"",
          "strengths":[],
          "findings":[],
          "recommendations":[]
      },

      {
      "key":"chapter_integrity_pass",
          "name":"Chapter Integrity Pass",
          "score":9,
          "assessment":"",
             "strengths":[],
          "findings":[],
          "recommendations":[]
      },

      {
      "key":"placement_review",
          "name":"Placement Review",
          "score":6,
          "assessment":"",
             "strengths":[],
          "findings":[],
          "recommendations":[]
      },

      {
      "key":"flow_test",
          "name":"Flow Test",
          "score":7,
          "assessment":"",
             "strengths":[],
          "findings":[],
          "recommendations":[]
      },

      {
      "key":"precision_integrity_test",
          "name":"Precision Integrity Test",
          "score":7,
          "assessment":"",
             "strengths":[],
          "findings":[],
          "recommendations":[]
      },

      {
      "key":"executive_readability_tightening",
          "name":"Executive Readability Tightening",
          "score":8,
          "assessment":"",
             "strengths":[],
          "findings":[],
          "recommendations":[]
      },


      {
      "key":"compression_pass",
          "name":"Compression Pass",
          "score":9,
          "assessment":"",
             "strengths":[],
          "findings":[],
          "recommendations":[]
      }

  ],
"priority_revisions":[
{
"priority":"High",
"chapter":1,
"issue":"",
"action":"",
"impact":"",
"estimated_effort":""
}
],

  "final_recommendation":"",


"next_steps":[
  "",
  "",
  ""
],
  "narrative_report":"",

"metadata":{
   "model_version":"",
   "analysis_mode":"",
   "word_count_estimate":0,
   "certification_rule_applied":true
}
}
`;

    console.log("Calling Gemini for Final Report...");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    console.log("Gemini Final Report Generated");

    console.log("========== GEMINI RESPONSE ==========");
console.log(response.text);
console.log("====================================");

    const report = parseGeminiJSON(response.text || "");

    report.metadata = {
      model_version: "gemini-2.5-flash",
      analysis_mode: "full",
      word_count_estimate: chapterMap.book.total_words,
      certification_rule_applied: true,
    };

    return calculateTavScore(report);
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
  }
};

module.exports = {
  runTavAnalysis,
};
