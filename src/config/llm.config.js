/** @format */

const axios = require("axios");
const config = require("./config");
const { ai, ThinkingLevel } = require("./geminiConfig");

const askGrok = async (prompt) => {
  const response = await axios.post(
    "https://api.x.ai/v1/chat/completions",
    {
      model: config.models.grok,
      messages: [
        { role: "system", content: "You are a precise, factual assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${config.GROK_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    },
  );


  if (!response.data?.choices?.length) {
    throw new Error("Empty response from Grok");
  }

  const content = response.data?.choices?.[0]?.message?.content;


  return content;
};

const askLLM = async (prompt) => {
  return askGrok(prompt);
};

const safeJSONParse = (text) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");

    return JSON.parse(match[0]);
  } catch (err) {
    console.error("❌ JSON parse failed for AI response");
    throw new Error("Invalid JSON from AI");
  }
};

async function factCheckClaim(claim) {
  if (!claim || typeof claim !== "string") {
    throw new Error("Invalid claim provided");
  }

  const prompt = `
  Verify the following claim using web search only.

  Claim: ${claim}

  Respond STRICTLY in valid JSON with this schema:
  {
    "verdict": true | false,
    "explanation": string,
    "citations": [
      { "title": string, "url": string },
      { "title": string, "url": string },
      { "title": string, "url": string }
    ]
  }

  Rules:
  - Return EXACTLY 3 citations
  - Use reputable sources only
  - Do NOT include any text outside JSON
  `;

  try {
    const response = await ai.models.generateContent({
      model: config.models.geminiFactCheck,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        httpOptions: { timeout: 30_000 },
      },
    });

    // .text joins all text parts and skips thought parts (grounded answers can span several parts)
    const rawText = response.text;

    if (!rawText) {
      throw new Error("Empty response from Gemini");
    }

    // Hard JSON parse (fail fast if model breaks format)
    const parsed = safeJSONParse(rawText);

    // Minimal validation
    if (
      typeof parsed.verdict !== "boolean" ||
      typeof parsed.explanation !== "string" ||
      !Array.isArray(parsed.citations) ||
      parsed.citations.length !== 3
    ) {
      throw new Error("Invalid response structure");
    }

    return parsed;
  } catch (error) {
    if (error.status) {
      throw new Error(`Gemini API error: ${error.status} ${error.message}`);
    }
    throw error;
  }
}

const askGrokConsistancy = async (messages) => {
  const response = await axios.post(
    "https://api.x.ai/v1/chat/completions",
    {
      model: config.models.grok,
      messages,
      temperature: 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${config.GROK_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 60000, // 🔥 increased timeout
    }
  );

  if (!response.data?.choices?.length) {
    throw new Error("Empty response from Grok");
  }

  const content = response.data.choices[0].message.content;

  // 🔥 Extract valid JSON safely
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Invalid JSON from Grok");
  }

  return jsonMatch[0];
};

module.exports = {
  askLLM,
  factCheckClaim,
  askGrokConsistancy,
};
