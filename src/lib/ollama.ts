import { spawn } from "child_process";
import { Config } from "../config";

export class OllamaError extends Error {}

export interface StructuredSummary {
  title: string;
  bullets: string[];
  tags: string[];
  actionItems: string[];
}

export interface SummaryResult {
  structured: StructuredSummary | null;
  rawText: string;
}

interface OllamaTagsResponse {
  models?: { name: string }[];
}

/** Verifies Ollama is running and the configured model is available. Throws with an actionable message otherwise. */
export async function checkOllamaReady(config: Config): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${config.OLLAMA_URL}/api/tags`);
  } catch (err) {
    throw new OllamaError(
      `Could not reach Ollama at ${config.OLLAMA_URL}.\n` +
        `Start it with: ollama serve`
    );
  }

  if (!response.ok) {
    throw new OllamaError(
      `Ollama at ${config.OLLAMA_URL} responded with HTTP ${response.status}.`
    );
  }

  const data = (await response.json()) as OllamaTagsResponse;
  const models = (data.models || []).map((m) => m.name);
  const found = models.some(
    (name) => name === config.OLLAMA_MODEL || name.startsWith(`${config.OLLAMA_MODEL.split(":")[0]}:`)
  );

  if (!found) {
    throw new OllamaError(
      `Model "${config.OLLAMA_MODEL}" is not available in Ollama.\n` +
        `Available models: ${models.join(", ") || "(none)"}\n` +
        `Pull it with: ollama pull ${config.OLLAMA_MODEL}\n` +
        `Or update OLLAMA_MODEL in config.json to match \`ollama list\`.`
    );
  }
}

async function isOllamaReachable(config: Config): Promise<boolean> {
  try {
    const response = await fetch(`${config.OLLAMA_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

function startOllamaServe(): void {
  const child = spawn("ollama", ["serve"], { detached: true, stdio: "ignore" });
  child.on("error", () => {
    // Swallowed: unreachable-after-start-attempt is reported by waitForOllama's timeout instead.
  });
  child.unref();
}

async function waitForOllama(config: Config, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isOllamaReachable(config)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new OllamaError(
    `Tried to auto-start Ollama but it didn't become reachable at ${config.OLLAMA_URL} within ${
      timeoutMs / 1000
    }s.\n` + `Check that the "ollama" binary is installed and on PATH, then run \`ollama serve\` manually.`
  );
}

/**
 * Ensures Ollama is running (auto-starting `ollama serve` if not) and that the
 * configured model is available. Throws with an actionable message otherwise.
 */
export async function ensureOllamaReady(
  config: Config,
  onProgress?: (message: string) => void
): Promise<void> {
  if (!(await isOllamaReachable(config))) {
    onProgress?.("Ollama not running — starting it...");
    startOllamaServe();
    await waitForOllama(config, 20000);
    onProgress?.("Ollama is up.");
  }
  await checkOllamaReady(config);
}

const PROMPT_TEMPLATE = (transcript: string) => `You are given the transcript of a short Instagram video.
Summarize it and return ONLY a JSON object with this exact shape, no prose, no markdown fences:

{
  "title": "short descriptive title, under 10 words",
  "bullets": ["3 to 7 key takeaways as short bullet points"],
  "tags": ["3 to 6 lowercase single-word or hyphenated tags"],
  "action_items": ["any concrete actions mentioned, or empty array if none"]
}

Transcript:
"""
${transcript}
"""`;

export async function summarizeTranscript(
  transcript: string,
  config: Config
): Promise<SummaryResult> {
  const response = await fetch(`${config.OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.OLLAMA_MODEL,
      prompt: PROMPT_TEMPLATE(transcript),
      format: "json",
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new OllamaError(
      `Ollama /api/generate responded with HTTP ${response.status}.`
    );
  }

  const data = (await response.json()) as { response?: string };
  const rawText = (data.response || "").trim();

  const structured = tryParseStructured(rawText);
  return { structured, rawText };
}

function tryParseStructured(rawText: string): StructuredSummary | null {
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }

  if (
    typeof parsed.title !== "string" ||
    !Array.isArray(parsed.bullets) ||
    !Array.isArray(parsed.tags)
  ) {
    return null;
  }

  const actionItems = Array.isArray(parsed.action_items) ? parsed.action_items : [];

  return {
    title: parsed.title,
    bullets: parsed.bullets.filter((b: unknown) => typeof b === "string"),
    tags: parsed.tags.filter((t: unknown) => typeof t === "string"),
    actionItems: actionItems.filter((a: unknown) => typeof a === "string"),
  };
}
