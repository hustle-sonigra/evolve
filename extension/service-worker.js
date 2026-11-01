const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";
const COMMON_INSTRUCTIONS = `
Improve the draft prompt while preserving its intent, facts, constraints,
and desired outcome. Enhance clarity and structure without inventing details.
Make reasonable assumptions when information is missing. If the prompt is
too vague to interpret confidently, return exactly: "Please provide a clearer prompt."
Return only the improved prompt, without commentary or explanation.
`;
const MODE_INSTRUCTIONS = Object.freeze({
  BASIC: `Focus on general clarity, concise wording, logical structure, and flow.`,
  LEARNING: `Focus on learning and understanding. Where relevant, clarify the topic and learning level, and include simple explanations, step-by-step guidance, examples, or analogies where useful.`,
  CODING: `Focus on programming and software development. Where relevant, clarify the language, framework, environment, expected behavior, inputs, outputs, and constraints. Do not invent technical requirements.`,
  WRITING: `Focus on writing and content creation. Where relevant, clarify the audience, purpose, tone, style, format, and length while preserving the author's intended meaning and voice.`,
});
const ALLOWED_HOSTS = new Set([
  "gemini.google.com",
  "claude.ai",
  "write-box.appspot.com",
  "chatgpt.com"
]);
const ALLOWED_MODES = new Set(["BASIC", "LEARNING", "CODING", "WRITING"]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "PROMPT_REFINE_OPTIMIZE") return;

  const senderUrl = sender.tab?.url;
  let senderHost = "";
  try {
    senderHost = new URL(senderUrl).hostname;
  } catch {
    sendResponse({ error: "Could not verify the page requesting optimization." });
    return;
  }

  if (!ALLOWED_HOSTS.has(senderHost)) {
    sendResponse({ error: "Prompt Refine is not enabled on this site." });
    return;
  }

  if (typeof message.prompt !== "string" || !message.prompt.trim()) {
    sendResponse({ error: "Focus a text editor with a non-empty draft first." });
    return;
  }

  (async () => {
    const {
      optimizationMode = "BASIC",
      groqApiKey = "",
    } = await chrome.storage.local.get(["optimizationMode", "groqApiKey"]);
    const mode = ALLOWED_MODES.has(optimizationMode) ? optimizationMode : "BASIC";
    if (!groqApiKey) throw new Error("Add your Groq API key in the Prompt Refine popup first.");

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: `${COMMON_INSTRUCTIONS}\n\n${MODE_INSTRUCTIONS[mode]}`,
          },
          { role: "user", content: message.prompt },
        ],
        temperature: 0.3,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      const providerMessage = result.error?.message ?? result.error;
      if (response.status === 401 || response.status === 403) {
        throw new Error("Groq rejected the API key. Check or replace it in the extension popup.");
      }
      if (response.status === 429) {
        throw new Error("Groq rate limit reached. Wait a while or check your Groq plan limits.");
      }
      throw new Error(typeof providerMessage === "string" ? providerMessage : "Groq optimization failed.");
    }
    const optimizedPrompt = result.choices?.[0]?.message?.content?.trim();
    if (!optimizedPrompt) throw new Error("Groq returned an empty prompt.");
    sendResponse({ optimizedPrompt, mode });
  })().catch((error) => {
    const message = error instanceof TypeError
      ? "Could not reach Groq. Check your internet connection and try again."
      : error.message ?? "Prompt optimization failed.";
    sendResponse({ error: message });
  });

  // Keep the message channel open while the Groq request is in flight.
  return true;
});
