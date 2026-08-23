function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const RAW_PASSTHROUGH_LINES = new Set(["<details>", "<summary>Click to expand</summary>", "</details>"]);

/** Renders a note's markdown body (frontmatter stripped) to safe HTML for the dashboard. */
export function renderNoteBodyHtml(markdown: string): string {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
  const lines = body.split("\n");
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (RAW_PASSTHROUGH_LINES.has(trimmed)) {
      closeList();
      html.push(trimmed);
      continue;
    }
    if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("- [ ] ")) {
      if (!inList) {
        html.push('<ul class="checklist">');
        inList = true;
      }
      html.push(`<li><input type="checkbox" disabled> ${escapeHtml(line.slice(6))}</li>`);
      continue;
    }
    if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }
    if (line.startsWith("> ")) {
      closeList();
      html.push(`<blockquote>${escapeHtml(line.slice(2))}</blockquote>`);
      continue;
    }
    if (trimmed === "") {
      closeList();
      continue;
    }
    closeList();
    html.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();

  return html.join("\n");
}
