import * as fs from "fs";
import * as path from "path";
import { StructuredSummary } from "./ollama";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yamlList(items: string[]): string {
  if (items.length === 0) return "[]";
  return `[${items.map((t) => JSON.stringify(t)).join(", ")}]`;
}

export interface NoteInput {
  sourceUrl: string;
  transcript: string;
  noSpeechDetected: boolean;
  structured: StructuredSummary | null;
  rawSummaryText: string;
}

export function buildNote(input: NoteInput): { title: string; markdown: string } {
  const date = todayIso();
  const { sourceUrl, transcript, noSpeechDetected, structured, rawSummaryText } = input;

  const title =
    structured?.title ||
    `Instagram post - ${slugify(sourceUrl.split("/").filter(Boolean).pop() || "note")}`;

  const tags = structured?.tags || [];

  const lines: string[] = [];
  lines.push("---");
  lines.push(`title: ${JSON.stringify(title)}`);
  lines.push(`source: ${JSON.stringify(sourceUrl)}`);
  lines.push(`date: ${date}`);
  lines.push(`tags: ${yamlList(tags)}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${title}`);
  lines.push("");

  if (noSpeechDetected) {
    lines.push("## Key Points");
    lines.push("");
    lines.push("> No speech detected — visual-only content.");
    lines.push("");
  } else if (structured) {
    lines.push("## Key Points");
    lines.push("");
    for (const bullet of structured.bullets) {
      lines.push(`- ${bullet}`);
    }
    lines.push("");

    if (structured.actionItems.length > 0) {
      lines.push("## Action Items");
      lines.push("");
      for (const item of structured.actionItems) {
        lines.push(`- [ ] ${item}`);
      }
      lines.push("");
    }
  } else {
    lines.push("## Summary (unstructured)");
    lines.push("");
    lines.push(rawSummaryText || "*(Ollama returned no summary.)*");
    lines.push("");
  }

  lines.push("## Full Transcript");
  lines.push("");
  if (noSpeechDetected) {
    lines.push("*No speech detected.*");
  } else {
    lines.push("<details>");
    lines.push("<summary>Click to expand</summary>");
    lines.push("");
    lines.push(transcript);
    lines.push("");
    lines.push("</details>");
  }
  lines.push("");

  return { title, markdown: lines.join("\n") };
}

export interface NoteSummary {
  filename: string;
  title: string;
  date: string;
  tags: string[];
  source: string;
}

function matchFrontmatterField(frontmatter: string, key: string): string | null {
  const quoted = frontmatter.match(new RegExp(`^${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "m"));
  if (quoted) return quoted[1].replace(/\\"/g, '"');

  const bare = frontmatter.match(new RegExp(`^${key}:\\s*(\\S+)\\s*$`, "m"));
  return bare ? bare[1] : null;
}

function matchFrontmatterTags(frontmatter: string): string[] {
  const match = frontmatter.match(/^tags:\s*\[(.*)\]/m);
  if (!match || !match[1].trim()) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

/** Lists notes in the vault folder, newest first, parsed from their frontmatter. */
export function listNotes(vaultPath: string): NoteSummary[] {
  if (!fs.existsSync(vaultPath)) return [];

  const notes: NoteSummary[] = [];
  for (const filename of fs.readdirSync(vaultPath)) {
    if (!filename.endsWith(".md")) continue;

    const content = fs.readFileSync(path.join(vaultPath, filename), "utf-8");
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) continue;

    const frontmatter = frontmatterMatch[1];
    notes.push({
      filename,
      title: matchFrontmatterField(frontmatter, "title") || filename,
      date: matchFrontmatterField(frontmatter, "date") || "",
      source: matchFrontmatterField(frontmatter, "source") || "",
      tags: matchFrontmatterTags(frontmatter),
    });
  }

  return notes.sort(
    (a, b) => b.date.localeCompare(a.date) || b.filename.localeCompare(a.filename)
  );
}

/** Reads a single note's raw markdown content by filename, guarding against path traversal. */
export function readNote(vaultPath: string, filename: string): string {
  const safeName = path.basename(filename);
  const fullPath = path.join(vaultPath, safeName);
  const resolvedVault = path.resolve(vaultPath);
  if (!path.resolve(fullPath).startsWith(resolvedVault) || !fs.existsSync(fullPath)) {
    throw new Error(`Note not found: ${filename}`);
  }
  return fs.readFileSync(fullPath, "utf-8");
}

export function writeNote(vaultPath: string, title: string, markdown: string): string {
  fs.mkdirSync(vaultPath, { recursive: true });

  const date = todayIso();
  const baseSlug = slugify(title);
  let filename = `${date} - ${baseSlug}.md`;
  let counter = 2;
  while (fs.existsSync(path.join(vaultPath, filename))) {
    filename = `${date} - ${baseSlug}-${counter}.md`;
    counter += 1;
  }

  const fullPath = path.join(vaultPath, filename);
  fs.writeFileSync(fullPath, markdown, "utf-8");
  return fullPath;
}
