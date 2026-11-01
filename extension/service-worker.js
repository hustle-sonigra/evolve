const API_URL = "http://localhost:3001/api/optimize";
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
    const { optimizationMode = "BASIC" } = await chrome.storage.local.get("optimizationMode");
    const mode = ALLOWED_MODES.has(optimizationMode) ? optimizationMode : "BASIC";
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: message.prompt, mode }),
      targetAddressSpace: "loopback",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Optimization failed.");
    sendResponse({ optimizedPrompt: result.optimizedPrompt, mode });
  })().catch((error) => {
    const message = error instanceof TypeError
      ? "Could not reach the Prompt Refine API. Start the app with `npm run dev` and try again."
      : error.message ?? "Could not reach the Prompt Refine API.";
    sendResponse({ error: message });
  });

  // Keep the message channel open so the service worker can reply after fetch completes.
  return true;
});
