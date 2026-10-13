/** @format */

const axios = require("axios");
const config = require("./config");
const LLM_MODELS = {
  grok: "grok-3-mini",
};

const askGrok = async (prompt) => {
  console.log("11111111111111111111: ", config.GROK_API_KEY);
  const response = await axios.post(
    "https://api.x.ai/v1/chat/completions",
    {
      model: LLM_MODELS.grok,
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

  console.log("✅ GROK RAW RESPONSE:", JSON.stringify(response.data, null, 2));

  if (!response.data?.choices?.length) {
    throw new Error("Empty response from Grok");
  }

  const content = response.data?.choices?.[0]?.message?.content;

  console.log("🧠 GROK CONTENT:", content);

  return content;
};

const askLLM = async (prompt) => {
  console.log("reached here");
  return askGrok(prompt);
};

const safeJSONParse = (text) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");

    return JSON.parse(match[0]);
  } catch (err) {
    console.error("❌ JSON parse failed:", text);
    throw new Error("Invalid JSON from AI");
  }
};

async function factCheckClaim(claim) {
  if (!claim || typeof claim !== "string") {
    throw new Error("Invalid claim provided");
  }

  const GEMINI_API_KEY = config.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

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
    const response = await axios.post(
      url,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        tools: [{ google_search: {} }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        timeout: 30_000,
      },
    );

    console.log(response, "responsedhdjdhjwd");

    // Gemini returns text inside nested candidates
    const rawText = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;

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
    if (error.response) {
      throw new Error(
        `Gemini API error: ${error.response.status} ${JSON.stringify(
          error.response.data,
        )}`,
      );
    }
    throw error;
  }
}

const askGrokConsistancy = async (messages) => {
  const response = await axios.post(
    "https://api.x.ai/v1/chat/completions",
    {
      model: LLM_MODELS.grok,
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
