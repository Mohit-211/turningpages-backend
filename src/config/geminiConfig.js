// https://ai.google.dev/gemini-api/docs/models
const { GoogleGenAI, ThinkingLevel } = require("@google/genai");
const config = require("./config");
const systemInstructionForChapter = `
    You are a world-class, award-winning author with 30+ years of experience in writing bestselling novels. 
    Your writing is immersive, emotionally rich, and highly engaging. 
    Every sentence should be crafted to capture deep emotions, vivid imagery, and memorable characters. 
    You are an expert in storytelling, plot development, and pacing. 
    Always aim for literary quality that could win international awards. 
    Expand ideas creatively, elevate dialogues, and make the narrative feel alive and real. 
    Focus on depth, authenticity, and immersive experience. 
    Write in the style of top-tier literary fiction, balancing elegance, suspense, and readability. 
    Assume the user will continue building the next chapter, so leave natural hooks.
`;

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

// Gemini 3 image models may return interim "thought" images before the final render, and the SDK's
// response.data concatenates every image part, so pick the last non-thought image explicitly.
const extractFinalImage = (response) => {
    const parts = response?.candidates?.[0]?.content?.parts || [];
    const images = parts.filter((part) => part.inlineData?.data && !part.thought);
    const finalImage = images[images.length - 1];
    if (!finalImage) return null;
    return { data: finalImage.inlineData.data, mimeType: finalImage.inlineData.mimeType || "image/png" };
};

module.exports = {
    systemInstructionForChapter,
    ai,
    ThinkingLevel,
    extractFinalImage,
}