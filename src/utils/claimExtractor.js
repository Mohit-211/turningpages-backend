import { askLLM } from "./llm.service.js";

export const extractClaims = async (chapterText) => {
    const prompt = `
You are analyzing a book chapter.

Extract only verifiable factual claims.
Ignore opinions, fiction, metaphors.

Return JSON array:
[
  {
    "claim": "",
    "sentence": "",
    "category": "HISTORY | SCIENCE | STATISTICS | GENERAL"
  }
]

Text:
${chapterText}
`;

    const res = await askLLM(prompt);
    return JSON.parse(res);
};
