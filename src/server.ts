#!/usr/bin/env node
import express from "express";
import { spawn } from "child_process";

import { loadConfig } from "./config";
import { preflight, runPipeline, PipelineError } from "./pipeline";
import { listNotes, readNote } from "./lib/note";
import { renderNoteBodyHtml } from "./lib/render";
import { DASHBOARD_HTML } from "./dashboardHtml";

const PORT = Number(process.env.PORT) || 4321;

const config = loadConfig();
const app = express();

let isProcessing = false;

app.get("/", (_req, res) => {
  res.type("html").send(DASHBOARD_HTML);
});

app.get("/api/notes", (_req, res) => {
  res.json(listNotes(config.OBSIDIAN_VAULT_PATH));
});

app.get("/api/notes/:filename", (req, res) => {
  try {
    const raw = readNote(config.OBSIDIAN_VAULT_PATH, req.params.filename);
    res.json({ bodyHtml: renderNoteBodyHtml(raw) });
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/process", async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
  if (!url) {
    res.status(400).json({ error: "Missing url query parameter" });
    return;
  }
  if (isProcessing) {
    res.status(409).json({ error: "Another job is already running. Wait for it to finish." });
    return;
  }

  isProcessing = true;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await preflight(config, (msg) => send("progress", msg));
    const { notePath } = await runPipeline(url, config, (msg) => send("progress", msg));
    send("done", { notePath });
  } catch (err) {
    const message = err instanceof PipelineError || err instanceof Error ? err.message : String(err);
    send("failed", message);
  } finally {
    isProcessing = false;
    res.end();
  }
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Vaultgram dashboard running at ${url}`);
  const opener = spawn("open", [url], { stdio: "ignore" });
  opener.on("error", () => {
    // Non-fatal: user can open the URL manually.
  });
});
