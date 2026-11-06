export const ALLOWED_SITES_STORAGE_KEY = "allowedSites";

// Checkbox IDs map to the narrowest origin patterns the extension needs.
export const SITE_ORIGINS = Object.freeze({
  chatGPT: "https://chatgpt.com/*",
  Claude: "https://claude.ai/*",
  Gemini: "https://gemini.google.com/*",
  Gmail: "https://mail.google.com/*",
  Slackk: "https://app.slack.com/*",
  writo: "https://write-box.appspot.com/*",
});

export function getSiteOrigins(siteIds) {
  return [...new Set(siteIds.map((siteId) => SITE_ORIGINS[siteId]).filter(Boolean))];
}
