import {
  ALLOWED_HOSTS,
  ALLOWED_MODES,
  GROQ_MODEL,
} from "./groq-config.js";
import { getGroqErrorMessage, requestGroq } from "./groq-client.js";
import { prepareTelemetry, recordTelemetry } from "./telemetry.js";

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

  void optimizePrompt(request.prompt)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ error: getUserFacingError(error) });
    });

  // Keep the message channel open while Groq responds.
  return true;
});

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

  // Telemetry is optional and must not block a Groq optimization.
  let telemetryContext = null;
  try {
    telemetryContext = await prepareTelemetry({ prompt, mode, model: GROQ_MODEL });
  } catch {
    telemetryContext = null;
  }

  let telemetryRecorded = false;
  let requestResult = null;

  try {
    requestResult = await requestGroq(prompt, mode, groqApiKey);
    const { response, result } = requestResult;

    if (!response.ok) {
      telemetryRecorded = true;
      void recordTelemetry(telemetryContext, {
        status: `http_${response.status}`,
        responseMs: requestResult.responseMs,
        response,
        result,
      }).catch(() => {});

      throw new Error(getGroqErrorMessage(response, result));
    }

    const optimizedPrompt = result.choices?.[0]?.message?.content?.trim();
    if (!optimizedPrompt) {
      telemetryRecorded = true;
      void recordTelemetry(telemetryContext, {
        status: "request_error",
        responseMs: requestResult.responseMs,
        response,
        result,
      }).catch(() => {});
      throw new Error("Groq returned an empty prompt.");
    }

    telemetryRecorded = true;
    void recordTelemetry(telemetryContext, {
      status: "success",
      responseMs: requestResult.responseMs,
      response,
      result,
      successful: true,
    }).catch(() => {});

    return { optimizedPrompt, mode };
  } catch (error) {
    if (!telemetryRecorded) {
      const status = error instanceof TypeError ? "network_error" : "request_error";
      void recordTelemetry(telemetryContext, {
        status,
        responseMs: error.responseMs ?? requestResult?.responseMs ?? 0,
        response: error.response ?? requestResult?.response ?? null,
        result: error.result ?? requestResult?.result ?? null,
      }).catch(() => {});
    }
    throw error;
  }
}

function getUserFacingError(error) {
  return error instanceof TypeError
    ? "Could not reach Groq. Check your internet connection and try again."
    : error?.message ?? "Prompt optimization failed.";
}
