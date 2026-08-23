import { spawnSync } from "child_process";
import * as path from "path";

export class AudioExtractionError extends Error {}

/** Extracts 16kHz mono WAV audio from the video into tmpDir and returns its path. */
export function extractAudio(videoPath: string, tmpDir: string): string {
  const wavPath = path.join(tmpDir, "audio.wav");
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-i", videoPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath],
    { encoding: "utf-8" }
  );

  if (result.error) {
    throw new AudioExtractionError(
      `Could not run ffmpeg: ${result.error.message}. Is it on your PATH?`
    );
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new AudioExtractionError(
      `ffmpeg failed to extract audio.\n${stderr || "(no error output)"}`
    );
  }

  return wavPath;
}
