import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "vaultgram-"));
}

export function cleanupTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}
