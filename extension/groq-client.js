import { buildGroqPayload, GROQ_API_URL } from "./groq-config.js";

export async function requestGroq(prompt, mode, apiKey) {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildGroqPayload(prompt, mode)),
  });
  const result = await response.json();

  return {
    response,
    result,
  };
}

export function getGroqErrorMessage(response, result) {
  if (response.status === 401 || response.status === 403) {
    return "Groq rejected the API key. Check or replace it in the extension popup.";
  }
  if (response.status === 429) {
    return "Groq rate limit reached. Wait a while or check your Groq plan limits.";
  }

  const providerMessage = result?.error?.message ?? result?.error;
  return typeof providerMessage === "string"
    ? providerMessage
    : "Groq optimization failed.";
}
