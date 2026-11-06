import "dotenv/config";
import express from "express";
import { MODE_INSTRUCTIONS, optimizePrompt } from "./services/optimizer.js";
import { saveTelemetryEvent } from "./telemetry-db.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const extensionOrigin = process.env.EXTENSION_ORIGIN ?? "chrome-extension://pjndchipgihppgneieldlnagdloglkeo";

app.use((request, response, next) => {
  const origin = request.get("Origin");
  if (origin === extensionOrigin) {
    response.set("Access-Control-Allow-Origin", origin);
    response.set("Vary", "Origin");
  }

  if (request.method === "OPTIONS") {
    if (origin !== extensionOrigin) {
      return response.sendStatus(403);
    }
    response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.set("Access-Control-Allow-Headers", "Content-Type");
    return response.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

const TELEMETRY_MODES = new Set(["BASIC", "LEARNING", "CODING", "WRITING"]);
const TELEMETRY_STATUSES = new Set([
  "success",
  "network_error",
  "provider_error",
  "request_error",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isOptionalText = (value, maxLength = 120) =>
  value === null || value === undefined ||
  (typeof value === "string" && value.length <= maxLength);
const isOptionalCount = (value) =>
  value === null || value === undefined ||
  (Number.isInteger(value) && value >= 0);

app.post("/api/telemetry/events", async (request, response) => {
  const event = request.body;
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return response.status(400).json({ error: "Provide one telemetry event object." });
  }

  const requiredValid =
    UUID_PATTERN.test(event.event_id) &&
    UUID_PATTERN.test(event.install_id) &&
    UUID_PATTERN.test(event.session_id) &&
    typeof event.timestamp === "string" && Number.isFinite(Date.parse(event.timestamp)) &&
    TELEMETRY_MODES.has(event.mode) &&
    typeof event.model === "string" && event.model.length > 0 && event.model.length <= 120 &&
    Number.isInteger(event.prompt_chars) && event.prompt_chars >= 0 &&
    typeof event.status === "string" && event.status.length <= 20 &&
    (TELEMETRY_STATUSES.has(event.status) || /^http_[1-5]\d{2}$/.test(event.status)) &&
    typeof event.region_consent === "boolean";

  const optionalValid =
    isOptionalText(event.platform, 80) &&
    isOptionalText(event.topic, 100) &&
    isOptionalText(event.subtopic, 100) &&
    isOptionalCount(event.input_tokens) &&
    isOptionalCount(event.output_tokens) &&
    isOptionalCount(event.response_ms) &&
    isOptionalCount(event.refinements) &&
    isOptionalText(event.language, 35) &&
    isOptionalText(event.groq_region, 80) &&
    isOptionalText(event.user_agent_family, 80) &&
    isOptionalText(event.os, 80) &&
    isOptionalText(event.architecture, 80);

  if (!requiredValid || !optionalValid) {
    return response.status(400).json({ error: "Telemetry event has invalid or missing fields." });
  }

  // Only save the defined schema. Prompts, API keys, and arbitrary client fields are dropped.
  const safeEvent = {
    event_id: event.event_id,
    install_id: event.install_id,
    session_id: event.session_id,
    occurred_at: new Date(event.timestamp).toISOString(),
    platform: event.platform ?? null,
    mode: event.mode,
    model: event.model,
    topic: event.topic ?? null,
    subtopic: event.subtopic ?? null,
    prompt_chars: event.prompt_chars,
    input_tokens: event.input_tokens ?? null,
    output_tokens: event.output_tokens ?? null,
    response_ms: event.response_ms ?? null,
    status: event.status,
    refinements: event.refinements ?? null,
    language: event.language ?? null,
    user_region: null,
    groq_region: event.groq_region ?? null,
    region_consent: event.region_consent,
    user_agent_family: event.user_agent_family ?? null,
    os: event.os ?? null,
    architecture: event.architecture ?? null,
  };

  try {
    const userRegion = await resolveUserRegion(request);
    safeEvent.user_region = userRegion;
    const inserted = saveTelemetryEvent(safeEvent);
    return response.status(inserted ? 201 : 200).json({
      accepted: true,
      duplicate: !inserted,
    });
  } catch {
    return response.status(500).json({ error: "Could not save telemetry event." });
  }
});

const regionCache = new Map();
const REGION_CACHE_TTL_MS = 15 * 60 * 1000;
const LOCAL_REGION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === "production";

async function resolveUserRegion(request) {
  // Local requests arrive as loopback, so locate this machine's public egress IP.
  // In production, look up the IP Express resolved for the incoming request.
  const requestIp = request.ip?.replace(/^::ffff:/, "");
  const isLoopback = !requestIp || ["127.0.0.1", "::1"].includes(requestIp);
  if (!isLoopback && isProduction && !request.body.region_consent) {
    console.warn("User-region lookup skipped: production request has no region consent.");
    return null;
  }

  const cacheKey = isLoopback ? "local-egress" : requestIp;
  const cached = regionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.userRegion;

  const fields = "success,city,region,country";
  const url = isLoopback
    ? `https://ipwho.is/?fields=${fields}`
    : `https://ipwho.is/${encodeURIComponent(requestIp)}?fields=${fields}`;

  try {
    const result = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!result.ok) {
      console.warn(`User-region lookup failed with HTTP ${result.status}.`);
      return null;
    }
    const location = await result.json();
    if (!location.success) {
      console.warn("User-region lookup provider returned an error.");
      return null;
    }

    const cityName = typeof location.city === "string" ? location.city.trim() : "";
    const regionName = typeof location.region === "string" ? location.region.trim() : "";
    const countryName = typeof location.country === "string"
      ? location.country.trim()
      : "";
    const userRegion = [cityName || regionName, countryName]
      .filter(Boolean)
      .join(", ")
      .slice(0, 120);
    if (!userRegion) {
      console.warn("User-region lookup returned no city, region, or country.");
      return null;
    }

    regionCache.set(cacheKey, {
      userRegion,
      expiresAt: Date.now() + (isLoopback ? LOCAL_REGION_CACHE_TTL_MS : REGION_CACHE_TTL_MS),
    });
    return userRegion;
  } catch (error) {
    // Geo lookup is best-effort; telemetry should still be stored without a region.
    console.warn("User-region lookup failed (network, timeout, or invalid response).");
    return null;
  }
}

app.post("/api/optimize", async (request, response) => {
  const prompt = request.body?.prompt;
  const mode = request.body?.mode ?? "BASIC";
  if (typeof prompt !== "string" || !prompt.trim()) {
    return response.status(400).json({ error: "Provide a non-empty prompt." });
  }
  if (typeof mode !== "string" || !Object.hasOwn(MODE_INSTRUCTIONS, mode)) {
    return response.status(400).json({
      error: `Mode must be one of: ${Object.keys(MODE_INSTRUCTIONS).join(", ")}.`,
    });
  }
  if (prompt.length > 12_000) {
    return response.status(413).json({ error: "Prompt is too long (12,000 characters maximum)." });
  }
  if (!process.env.GROQ_API_KEY) {
    return response.status(503).json({ error: "The AI provider is not configured on the server." });
  }

  try {
    const optimizedPrompt = await optimizePrompt(prompt, mode);
    return response.json({ optimizedPrompt });
  } catch (error) {
    console.error("Prompt optimization failed:", error);
    return response.status(502).json({ error: "The optimizer could not complete the request. Please try again." });
  }
});

app.listen(port, () => {
  console.log(`Prompt Refine API listening on http://localhost:${port}`);
});
