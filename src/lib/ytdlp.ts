import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export class DownloadError extends Error {}

/** Downloads the video into tmpDir and returns the path to the downloaded file. */
export function downloadVideo(url: string, tmpDir: string): string {
  const outputTemplate = path.join(tmpDir, "video.%(ext)s");
  const result = spawnSync("yt-dlp", ["-o", outputTemplate, url], {
    encoding: "utf-8",
  });

  if (result.error) {
    throw new DownloadError(
      `Could not run yt-dlp: ${result.error.message}. Is it on your PATH?`
    );
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    throw new DownloadError(
      `yt-dlp failed to download the video.\n${stderr || "(no error output)"}`
    );
  }

  const downloaded = fs
    .readdirSync(tmpDir)
    .find((f) => f.startsWith("video."));

  if (!downloaded) {
    throw new DownloadError(
      "yt-dlp reported success but no output file was found in the temp directory."
    );
  }

  return path.join(tmpDir, downloaded);
}
