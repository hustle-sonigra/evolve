import "dotenv/config";
import express from "express";
import { MODE_INSTRUCTIONS, optimizePrompt } from "./services/optimizer.js";

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
