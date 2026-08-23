import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Config } from "../config";

export class TranscriptionError extends Error {}

export interface TranscriptionResult {
  transcript: string;
  noSpeechDetected: boolean;
}

export function transcribeAudio(
  wavPath: string,
  tmpDir: string,
  config: Config
): TranscriptionResult {
  const outPrefix = path.join(tmpDir, "transcript");
  const result = spawnSync(
    config.WHISPER_CPP_PATH,
    [
      "-m",
      config.WHISPER_MODEL_PATH,
      "-f",
      wavPath,
      "-l",
      config.WHISPER_LANGUAGE,
      "-otxt",
      "-of",
      outPrefix,
    ],
    { encoding: "utf-8" }
  );

  if (result.error) {
    throw new TranscriptionError(
      `Could not run whisper.cpp binary at ${config.WHISPER_CPP_PATH}: ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new TranscriptionError(
      `whisper.cpp failed to transcribe the audio.\n${stderr || "(no error output)"}`
    );
  }

  const txtPath = `${outPrefix}.txt`;
  if (!fs.existsSync(txtPath)) {
    throw new TranscriptionError(
      `whisper.cpp reported success but no transcript file was found at ${txtPath}.`
    );
  }

  const transcript = fs
    .readFileSync(txtPath, "utf-8")
    .replace(/�/g, "") // drop stray replacement chars from occasional garbled/repeated segments
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { transcript, noSpeechDetected: transcript.length === 0 };
}
