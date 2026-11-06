import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const databasePath = resolve(
  serverDirectory,
  process.env.TELEMETRY_DB_PATH ?? "../data/telemetry.sqlite",
);

mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS optimization_events (
    event_id TEXT PRIMARY KEY,
    install_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    platform TEXT,
    mode TEXT NOT NULL CHECK (mode IN ('BASIC', 'LEARNING', 'CODING', 'WRITING')),
    model TEXT NOT NULL,
    topic TEXT,
    subtopic TEXT,
    prompt_chars INTEGER NOT NULL CHECK (prompt_chars >= 0),
    input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
    output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
    response_ms INTEGER CHECK (response_ms IS NULL OR response_ms >= 0),
    status TEXT NOT NULL,
    refinements INTEGER CHECK (refinements IS NULL OR refinements >= 0),
    language TEXT,
    region_consent INTEGER NOT NULL DEFAULT 0 CHECK (region_consent IN (0, 1)),
    user_agent_family TEXT,
    os TEXT,
    architecture TEXT,
    user_region TEXT,
    groq_region TEXT,
    received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS optimization_events_time_idx
    ON optimization_events (occurred_at);
  CREATE INDEX IF NOT EXISTS optimization_events_install_session_idx
    ON optimization_events (install_id, session_id, occurred_at);
`);

const existingColumns = new Set(
  database.prepare("PRAGMA table_info(optimization_events)").all().map(({ name }) => name),
);
if (!existingColumns.has("user_region")) {
  database.exec("ALTER TABLE optimization_events ADD COLUMN user_region TEXT");
}
if (!existingColumns.has("groq_region")) {
  database.exec("ALTER TABLE optimization_events ADD COLUMN groq_region TEXT");
}
if (existingColumns.has("region")) {
  database.exec(`
    UPDATE optimization_events
    SET groq_region = region
    WHERE groq_region IS NULL AND region IS NOT NULL;
    ALTER TABLE optimization_events DROP COLUMN region;
  `);
}


const insertEvent = database.prepare(`
  INSERT INTO optimization_events (
    event_id, install_id, session_id, occurred_at, platform, mode, model,
    topic, subtopic, prompt_chars, input_tokens, output_tokens, response_ms,
    status, refinements, language, region_consent,
    user_agent_family, os, architecture, user_region, groq_region
  ) VALUES (
    $event_id, $install_id, $session_id, $occurred_at, $platform, $mode, $model,
    $topic, $subtopic, $prompt_chars, $input_tokens, $output_tokens, $response_ms,
    $status, $refinements, $language, $region_consent,
    $user_agent_family, $os, $architecture, $user_region, $groq_region
  ) ON CONFLICT(event_id) DO NOTHING
`);

export function saveTelemetryEvent(event) {
   console.log("Received refinement telemetry:", event);
  const result = insertEvent.run({
    ...event,
    region_consent: event.region_consent ? 1 : 0,
  });
  return result.changes === 1;
}
