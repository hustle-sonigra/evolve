import { ALLOWED_HOSTS, ALLOWED_MODES } from "./groq-config.js";
import { getGroqErrorMessage, requestGroq } from "./groq-client.js";
import { ALLOWED_SITES_STORAGE_KEY, SITE_ORIGINS } from "./site-config.js";

const CONTENT_SCRIPT_ID = "prompt-refine-selected-sites";
let scriptSyncQueue = Promise.resolve();

function queueSelectedSiteScriptSync() {
  scriptSyncQueue = scriptSyncQueue.catch(() => {}).then(syncSelectedSiteScripts);
  return scriptSyncQueue;
}

async function syncSelectedSiteScripts() {
  const [{ [ALLOWED_SITES_STORAGE_KEY]: savedSites = [] }, granted] = await Promise.all([
    chrome.storage.local.get(ALLOWED_SITES_STORAGE_KEY),
    chrome.permissions.getAll(),
  ]);
  const grantedOrigins = new Set(granted.origins ?? []);
  const matches = [...new Set(savedSites
    .map((siteId) => SITE_ORIGINS[siteId])
    .filter((origin) => origin && grantedOrigins.has(origin)))];

  await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] }).catch(() => {});
  if (matches.length) {
    await chrome.scripting.registerContentScripts([{
      id: CONTENT_SCRIPT_ID,
      matches,
      js: ["content.js"],
      runAt: "document_idle",
    }]);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void queueSelectedSiteScriptSync().catch(console.error);
});
chrome.runtime.onStartup.addListener(() => {
  void queueSelectedSiteScriptSync().catch(console.error);
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[ALLOWED_SITES_STORAGE_KEY]) {
    void queueSelectedSiteScriptSync().catch(console.error);
  }
});
chrome.permissions.onRemoved.addListener(() => {
  void queueSelectedSiteScriptSync().catch(console.error);
});
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type !== "SYNC_SELECTED_SITE_SCRIPTS") return;
  void queueSelectedSiteScriptSync()
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ error: "Could not update site scripts." }));
  return true;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type !== "PROMPT_REFINE_OPTIMIZE") return;

  const senderHost = getSenderHost(sender.tab?.url);
  if (!senderHost || !ALLOWED_HOSTS.has(senderHost)) {
    sendResponse({ error: "Prompt Refine is not enabled on this site." });
    return;
  }

  if (typeof request.prompt !== "string" || !request.prompt.trim()) {
    sendResponse({ error: "Focus a text editor with a non-empty draft first." });
    return;
  }

  void isSiteEnabled(senderHost)
    .then((enabled) => {
      if (!enabled) throw new Error("Enable this site in the Prompt Refine popup first.");
      return optimizePrompt(request.prompt);
    })
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ error: getUserFacingError(error) });
    });

  // Keep the message channel open while Groq responds.
  return true;
});

async function isSiteEnabled(host) {
  const [{ [ALLOWED_SITES_STORAGE_KEY]: savedSites = [] }, granted] = await Promise.all([
    chrome.storage.local.get(ALLOWED_SITES_STORAGE_KEY),
    chrome.permissions.getAll(),
  ]);
  return savedSites.some((siteId) => {
    const origin = SITE_ORIGINS[siteId];
    return origin && new URL(origin.replace("/*", "/")).hostname === host &&
      (granted.origins ?? []).includes(origin);
  });
}

function getSenderHost(senderUrl) {
  try {
    return new URL(senderUrl).hostname;
  } catch {
    return "";
  }
}

async function optimizePrompt(prompt) {
  const { optimizationMode = "BASIC", groqApiKey = "" } =
    await chrome.storage.local.get(["optimizationMode", "groqApiKey"]);
  const mode = ALLOWED_MODES.has(optimizationMode) ? optimizationMode : "BASIC";
  if (!groqApiKey) {
    throw new Error("Add your Groq API key in the Prompt Refine popup first.");
  }

  const { response, result } = await requestGroq(prompt, mode, groqApiKey);
  if (!response.ok) throw new Error(getGroqErrorMessage(response, result));

  const optimizedPrompt = result.choices?.[0]?.message?.content?.trim();
  if (!optimizedPrompt) throw new Error("Groq returned an empty prompt.");
  return { optimizedPrompt, mode };
}

function getUserFacingError(error) {
  return error instanceof TypeError
    ? "Could not reach Groq. Check your internet connection and try again."
    : error?.message ?? "Prompt optimization failed.";
}
