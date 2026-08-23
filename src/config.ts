import * as fs from "fs";
import * as path from "path";

export interface Config {
  WHISPER_CPP_PATH: string;
  WHISPER_MODEL_PATH: string;
  WHISPER_LANGUAGE: string;
  OBSIDIAN_VAULT_PATH: string;
  OLLAMA_MODEL: string;
  OLLAMA_URL: string;
}

const REQUIRED_KEYS: (keyof Config)[] = [
  "WHISPER_CPP_PATH",
  "WHISPER_MODEL_PATH",
  "WHISPER_LANGUAGE",
  "OBSIDIAN_VAULT_PATH",
  "OLLAMA_MODEL",
  "OLLAMA_URL",
];

export function loadConfig(): Config {
  const configPath = path.join(__dirname, "..", "config.json");

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}\n` +
        `Copy config.example.json to config.json and fill in your local paths.`
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (err) {
    throw new Error(`Failed to parse config.json: ${(err as Error).message}`);
  }

  const config = raw as Partial<Config>;
  const missing = REQUIRED_KEYS.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `config.json is missing required field(s): ${missing.join(", ")}`
    );
  }

  return config as Config;
}
