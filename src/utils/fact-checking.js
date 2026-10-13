/** @format */

const { askLLM, factCheckClaim } = require("../config/llm.config");


const extractClaims = async (chapterText) => {
  try {
    const prompt = `
Extract factual claims from the text below.

Return them as a JSON array.

Each item must have:
- claim (string)
- sentence (string)
- category (HISTORY | SCIENCE | STATISTICS | GENERAL)

IMPORTANT:
- Even if unsure, extract best possible claims.
- Do NOT return empty array unless text has absolutely no factual content.
- You may slightly simplify sentences if needed.

Return ONLY JSON. No explanation.

Text:
${chapterText}
`;

    const res = await askLLM(prompt);

    return extractJSON(res);
  } catch (err) {
    return [];
  }
};

const cleanLLMResponse = (text) => {
  if (!text) return "";

  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
};

const extractJSON = (text) => {
  try {
    const cleaned = cleanLLMResponse(text);

    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array found");

    return JSON.parse(match[0]);
  } catch (err) {
    console.error("❌ Could not parse claims from AI response");

    // ✅ fallback extraction
    return text
      .split(".")
      .map((s) => s.trim())
      .filter((s) => s.length > 40)
      .slice(0, 3)
      .map((s) => ({
        claim: s,
        sentence: s,
        category: "GENERAL",
      }));
  }
};

const factCheckChapter = async (chapterText) => {
  console.log("STEP A: extracting claims");

const claims = (await extractClaims(chapterText)).slice(0, 2);

  console.log("STEP B: claims extracted:", claims.length);

  // ✅ PARALLEL EXECUTION
  const responses = await Promise.allSettled(
    claims.map((claim) => withTimeout(factCheckClaim(claim.claim), 60000)),
  );

  const results = responses.map((res, index) => {
    const claim = claims[index];

    if (res.status === "fulfilled") {
      return {
        ...res.value,
        claim: claim.claim,
      };
    } else {
      console.log("❌ Claim check failed:", res.reason?.message);

      return {
        claim: claim.claim,
        verdict: "PENDING",
        explanation:
          "Verification is still in progress. Results may update shortly.",
        citations: [],
      };
    }
  });

  console.log("STEP 4: got factCheckResult");

  return results;
};

const withTimeout = (promise, ms = 60000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        console.log("⏱️ TIMEOUT HIT");
        reject(new Error("Timeout"));
      }, ms),
    ),
  ]);
};

const buildConsistencyPrompt = (book) => {
  const { title, book_genre, book_chapters } = book;

  let formattedChapters = "";

  book_chapters.forEach((chapter) => {
    formattedChapters += `\n====================\n`;
formattedChapters += `CHAPTER ${chapter.globalIndex}: ${chapter.title}\n`;
    formattedChapters += `====================\n`;

    if (!chapter?.content) return;

    // 🔥 Remove HTML
    const cleanContent = chapter.content.replace(/<[^>]*>/g, "");

    const lines = cleanContent.split("\n");

    lines.forEach((line, lineIndex) => {
      if (line.trim()) {
        formattedChapters += `[${lineIndex + 1}] ${line.trim()}\n`;
      }
    });
  });

  return `
Check consistency of the following book.

BOOK TITLE: ${title}
GENRE: ${book_genre?.title || "Unknown"}

${formattedChapters}

--- END OF BOOK ---
`;
};

const CONSISTANCY_SYSTEM_PROMPT = `
You are a professional literary consistency analysis engine.

IMPORTANT INSTRUCTIONS:

- Use the chapter number EXACTLY as provided in the text (e.g., CHAPTER 4).
- Do NOT renumber chapters.
- Do NOT assume chapter numbers based on order.
- Always return the same chapter_number as written in the input.

CRITICAL INSTRUCTION:

The summary MUST be based on the detected issues.
If issues indicate mixing of unrelated sources or universes, the summary MUST explicitly mention it.

If the summary is generic or does not reflect the issues, the response is INVALID.

Your task is to analyze the provided book content and detect inconsistencies according to the following categories:

1. Character Consistency
   - Name spelling changes
   - Age contradictions
   - Personality inconsistencies
   - Knowledge inconsistencies

2. Timeline Consistency
   - Time jumps without explanation
   - Historical contradictions
   - Sequence logic errors

3. Terminology Consistency
   - Same concept referred with different names
   - Technical or magical system inconsistency

4. Lore Consistency
   - Worldbuilding contradictions
   - Rule violations of established magic system

5. Logical Contradictions
   - Impossible actions
   - Cause-effect inconsistencies

Return strict JSON only using the provided schema.

Return response in the following schema:

{
  "overall_consistency_score": number (0-100),
  "issues": [
    {
      "type": "character | timeline | terminology | lore | logic",
      "severity": "low | medium | high | critical",
      "chapter_number": number,
      "chapter_title": "string",
      "line_number": number,
      "line_text": "string",
      "issue_description": "clear explanation",
      "suggested_fix": "actionable suggestion"
    }
  ],
  "chapter_summary": [
    {
      "chapter_number": number,
      "chapter_title": "string",
      "consistency_score": number (0-100),
      "issue_count": number
    }
  ]
}

If there are no issues, return empty issues array.
Be strict and analytical.
Do not assume information not present in the text.
`;

const CHAPTER_SUMMARIZATION_SYSTEM_PROMPT = `
You are an elite literary summarization engine trained for professional publishing standards.

Your task is to produce a high-quality, precise, and industry-grade summary of the provided chapter content.

Strict Rules:

1. Use ONLY information explicitly present in the text.
2. Do NOT infer, speculate, interpret, or add external knowledge.
3. Preserve key plot developments, character actions, turning points, and major events.
4. Maintain strict chronological order.
5. Eliminate filler, repetition, and vague language.
6. Write in clear, polished, publication-ready prose.
7. Keep the summary dense, information-rich, and professionally structured.

Output Requirements:

- Return ONLY valid JSON.
- Do NOT include any explanation.
- Do NOT include markdown.
- Do NOT include additional keys.
- Do NOT include chapter number, title, metadata, or analysis.
- Output MUST strictly follow the schema below.

Schema:

{
  "summary": {
    "short_summary": "2-4 sentence concise, high-impact overview of the chapter",
    "detailed_summary": "A tightly written, chronologically accurate, professionally structured summary covering all major developments without interpretation."
  }
}

If the text contains insufficient information, summarize only what is clearly present.

Be precise. Be analytical. Be publication-quality.
`;

module.exports = {
  factCheckChapter,
  buildConsistencyPrompt,
  CONSISTANCY_SYSTEM_PROMPT,
  CHAPTER_SUMMARIZATION_SYSTEM_PROMPT,
};
