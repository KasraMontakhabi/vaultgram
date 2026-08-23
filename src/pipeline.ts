import * as fs from "fs";
import { spawnSync } from "child_process";

import { Config } from "./config";
import { createTempDir, cleanupTempDir } from "./lib/tempdir";
import { downloadVideo, DownloadError } from "./lib/ytdlp";
import { extractAudio, AudioExtractionError } from "./lib/ffmpeg";
import { transcribeAudio, TranscriptionError } from "./lib/whisper";
import { ensureOllamaReady, summarizeTranscript, OllamaError } from "./lib/ollama";
import { buildNote, writeNote } from "./lib/note";

export class PipelineError extends Error {}

export type ProgressCallback = (message: string) => void;

function checkOnPath(binary: string): boolean {
  const result = spawnSync("which", [binary], { encoding: "utf-8" });
  return result.status === 0;
}

/** Fails fast with a clear message before any download/temp-file work happens. */
export async function preflight(config: Config, onProgress: ProgressCallback): Promise<void> {
  onProgress("Checking environment...");

  if (!checkOnPath("yt-dlp")) {
    throw new PipelineError("yt-dlp not found on PATH. Install it with: brew install yt-dlp");
  }
  if (!checkOnPath("ffmpeg")) {
    throw new PipelineError("ffmpeg not found on PATH. Install it with: brew install ffmpeg");
  }

  try {
    fs.accessSync(config.WHISPER_CPP_PATH, fs.constants.X_OK);
  } catch {
    throw new PipelineError(
      `whisper.cpp binary not found or not executable at: ${config.WHISPER_CPP_PATH}\n` +
        `See README.md for build instructions.`
    );
  }

  if (!fs.existsSync(config.WHISPER_MODEL_PATH)) {
    throw new PipelineError(`Whisper model file not found at: ${config.WHISPER_MODEL_PATH}`);
  }

  try {
    await ensureOllamaReady(config, onProgress);
  } catch (err) {
    throw new PipelineError((err as Error).message);
  }

  fs.mkdirSync(config.OBSIDIAN_VAULT_PATH, { recursive: true });
  onProgress("OK");
}

export async function runPipeline(
  url: string,
  config: Config,
  onProgress: ProgressCallback
): Promise<{ notePath: string }> {
  const tmpDir = createTempDir();
  let notePath: string | null = null;
  let pipelineError: string | null = null;

  try {
    onProgress("[1/5] Downloading video...");
    const videoPath = downloadVideo(url, tmpDir);

    onProgress("[2/5] Extracting audio...");
    const wavPath = extractAudio(videoPath, tmpDir);

    onProgress("[3/5] Transcribing audio...");
    const { transcript, noSpeechDetected } = transcribeAudio(wavPath, tmpDir, config);
    if (noSpeechDetected) {
      onProgress("No speech detected — visual-only content.");
    }

    onProgress("[4/5] Summarizing with Ollama...");
    let structured = null;
    let rawSummaryText = "";
    if (!noSpeechDetected) {
      const result = await summarizeTranscript(transcript, config);
      structured = result.structured;
      rawSummaryText = result.rawText;
      if (!structured) {
        onProgress("Ollama output didn't parse cleanly — falling back to raw summary.");
      }
    }

    onProgress("[5/5] Writing note...");
    const { title, markdown } = buildNote({
      sourceUrl: url,
      transcript,
      noSpeechDetected,
      structured,
      rawSummaryText,
    });
    notePath = writeNote(config.OBSIDIAN_VAULT_PATH, title, markdown);
  } catch (err) {
    if (
      err instanceof DownloadError ||
      err instanceof AudioExtractionError ||
      err instanceof TranscriptionError ||
      err instanceof OllamaError
    ) {
      pipelineError = err.message;
    } else {
      throw err;
    }
  } finally {
    cleanupTempDir(tmpDir);
  }

  if (pipelineError) {
    throw new PipelineError(pipelineError);
  }

  return { notePath: notePath! };
}
