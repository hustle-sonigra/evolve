export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL = "openai/gpt-oss-20b";

export const ALLOWED_HOSTS = new Set([
  "gemini.google.com",
  "claude.ai",
  "write-box.appspot.com",
  "chatgpt.com",
  "mail.google.com",
  "app.slack.com",
]);

export const ALLOWED_MODES = new Set(["BASIC", "LEARNING", "CODING", "WRITING"]);

const COMMON_INSTRUCTIONS = `
Improve the draft prompt while preserving its intent, facts, constraints,
and desired outcome. Enhance clarity and structure without inventing details.
Make reasonable assumptions when information is missing. If the prompt is
too vague to interpret confidently, return exactly: "Please provide a clearer prompt."
Return only the improved prompt, without commentary or explanation.
`;

export const MODE_INSTRUCTIONS = Object.freeze({
  BASIC: "Focus on general clarity, concise wording, logical structure, and flow.",
  LEARNING: "Focus on learning and understanding. Where relevant, clarify the topic and learning level, and include simple explanations, step-by-step guidance, examples, or analogies where useful.",
  CODING: "Focus on programming and software development. Where relevant, clarify the language, framework, environment, expected behavior, inputs, outputs, and constraints. Do not invent technical requirements.",
  WRITING: "Focus on writing and content creation. Where relevant, clarify the audience, purpose, tone, style, format, and length while preserving the author's intended meaning and voice.",
});

export function buildGroqPayload(prompt, mode) {
  return {
    model: GROQ_MODEL,
    messages: [
      {
        role: "system",
        content: `${COMMON_INSTRUCTIONS}\n\n${MODE_INSTRUCTIONS[mode]}`,
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
  };
}
