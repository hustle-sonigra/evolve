const TELEMETRY_URL = "http://localhost:3001/api/telemetry/events";

async function getTelemetryIds() {
  let { installId } = await chrome.storage.local.get("installId");
  if (!installId) {
    installId = crypto.randomUUID();
    await chrome.storage.local.set({ installId });
  }

  let { sessionId } = await chrome.storage.session.get("sessionId");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    await chrome.storage.session.set({ sessionId, refinements: 0 });
  }

  const { refinements = 0 } = await chrome.storage.session.get("refinements");
  return { installId, sessionId, refinements };
}

async function getClientInfo() {
  const platformInfo = await chrome.runtime.getPlatformInfo();
  const brands = navigator.userAgentData?.brands ?? [];
  const browserBrand = brands.find(({ brand }) =>
    /Google Chrome|Chromium|Microsoft Edge/i.test(brand)
  );

  return {
    platform: "chrome_extension",
    os: platformInfo.os ?? "unknown",
    architecture: platformInfo.arch ?? "unknown",
    user_agent_family: browserBrand?.brand ?? "unknown",
    language: chrome.i18n.getUILanguage() ?? "unknown",
  };
}

function classifyPromptLocally(_prompt) {
  // Populate only after an explicit, documented classification approach is chosen.
  return { topic: null, subtopic: null };
}

export async function prepareTelemetry({ prompt, mode, model }) {
  const { telemetryEnabled = false, regionConsent = false } =
    await chrome.storage.local.get(["telemetryEnabled", "regionConsent"]);
  if (!telemetryEnabled) return null;

  const [ids, clientInfo] = await Promise.all([
    getTelemetryIds(),
    getClientInfo(),
  ]);

  return {
    event_id: crypto.randomUUID(),
    install_id: ids.installId,
    session_id: ids.sessionId,
    timestamp: new Date().toISOString(),
    ...clientInfo,
    mode,
    model,
    ...classifyPromptLocally(prompt),
    prompt_chars: Array.from(prompt).length,
    refinements: ids.refinements,
    region_consent: Boolean(regionConsent),
  };
}

export async function recordTelemetry(context, {
  status,
  responseMs,
  response = null,
  result = null,
  successful = false,
}) {
  if (!context) return;

  let refinements = context.refinements;
  if (successful) {
    refinements += 1;
    await chrome.storage.session.set({ refinements });
  }

  const event = {
    ...context,
    refinements,
    input_tokens: result?.usage?.prompt_tokens ?? null,
    output_tokens: result?.usage?.completion_tokens ?? null,
    response_ms: Math.max(0, Math.round(responseMs)),
    status,
    // This is Groq's processing region, not the user's geographic location.
    groq_region: response?.headers?.get("x-groq-region") ?? null,
  };

  try {
    await fetch(TELEMETRY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch {
    // Telemetry failure must not prevent optimization.
  }
}
