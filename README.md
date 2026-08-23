# Vaultgram

A personal, fully-local pipeline: Instagram video URL → transcript (whisper.cpp)
→ structured summary (local Ollama model) → Markdown note in your Obsidian vault.

Everything runs locally. No paid APIs.

> **Note:** paths in this README (e.g. `/Users/kasra/...`) are examples from
> the original setup. Replace `kasra` with your own macOS username, and
> adjust `whisper.cpp` / vault paths to wherever they actually live on your
> machine — both in the commands you run and in your own `config.json`.

## Prerequisites (already installed)

- `yt-dlp` and `ffmpeg` on PATH (`brew install yt-dlp ffmpeg` if you ever need
  to reinstall)
- [Ollama](https://ollama.com) installed, with your model pulled
  (e.g. `ollama pull llama3.1:8b`)
- A cloned copy of [whisper.cpp](https://github.com/ggml-org/whisper.cpp)
  with a model downloaded

### Building whisper.cpp

If you haven't built it yet:

```bash
cd ~/whisper.cpp
cmake -B build
cmake --build build --config Release
```

The resulting binary will be at `~/whisper.cpp/build/bin/whisper-cli`.

## Setup

1. Install dependencies and compile:

   ```bash
   npm install
   npm run build
   ```

2. Configure paths. `config.json` already exists with defaults for this
   machine, but double check them (or start fresh from `config.example.json`):

   ```json
   {
     "WHISPER_CPP_PATH": "/Users/<your-username>/whisper.cpp/build/bin/whisper-cli",
     "WHISPER_MODEL_PATH": "/Users/<your-username>/whisper.cpp/models/ggml-medium.bin",
     "WHISPER_LANGUAGE": "auto",
     "OBSIDIAN_VAULT_PATH": "/Users/<your-username>/Documents/YourVault/Instagram Notes",
     "OLLAMA_MODEL": "llama3.1:8b",
     "OLLAMA_URL": "http://localhost:11434"
   }
   ```

   `WHISPER_MODEL_PATH` points at the multilingual `medium` model (not an
   `.en`-suffixed one), so `WHISPER_LANGUAGE: "auto"` lets whisper.cpp
   auto-detect the spoken language per video — including Persian/Farsi —
   instead of assuming English. Set it to a fixed code (e.g. `"fa"`,
   `"en"`) instead of `"auto"` if you'd rather force one language.

3. Confirm your Ollama model tag matches what's actually pulled:

   ```bash
   ollama list
   ```

   If it doesn't match `llama3.1:8b`, update `OLLAMA_MODEL` in
   `config.json`.

   You don't need to start `ollama serve` yourself — both the CLI script and
   the dashboard auto-start it if it's not already running, and wait for it
   to come up before proceeding.

## Usage

### CLI

```bash
node dist/process.js "https://www.instagram.com/reel/XXXXX/"
```

The script:

1. Checks that yt-dlp, ffmpeg, your whisper.cpp binary/model, and Ollama
   (with the configured model) are all available — and fails fast with a
   clear message if anything's missing, before downloading anything.
2. Downloads the video to a temp directory.
3. Extracts 16kHz mono WAV audio with ffmpeg.
4. Transcribes it with your local whisper.cpp build.
5. Summarizes the transcript with your local Ollama model into a title,
   key bullets, tags, and action items.
6. Writes a Markdown note (`YYYY-MM-DD - slugified-title.md`) into your
   Obsidian vault folder.
7. Cleans up all temp files, whether it succeeds or fails.

If the video has no speech, a note is still written, clearly flagged as
"No speech detected — visual-only content" instead of a transcript/summary.

If Ollama's output doesn't parse into the expected JSON shape, the raw
model output is written under a `## Summary (unstructured)` heading instead
of failing the whole run.

### Dashboard

A local web dashboard lets you browse existing notes and kick off new ones
from the browser instead of the terminal:

```bash
npm run dashboard
```

This starts a server at `http://localhost:4321` and opens it in your default
browser automatically. From there you can:

- Paste an Instagram URL and click **Process** — progress streams live into a
  log panel, and the notes list refreshes when it's done.
- Browse all notes already in the vault, search by title, and filter by tag.
- Click a note to view its rendered content (key points, action items,
  transcript) without leaving the browser.

Only one job runs at a time; submitting a second URL while one is in
progress is rejected with a clear message until the first finishes. Ollama
is auto-started the same way as the CLI — no need to run `ollama serve`
first.

Stop the dashboard with `Ctrl+C` in the terminal it's running in.

## Triggering from a macOS Shortcut

Create a Shortcut with:

1. **Receive** input from Share Sheet (URLs, from Instagram).
2. **Run Shell Script**:
   - Shell: `/bin/zsh`
   - Script:
     ```bash
     /usr/bin/env node /Users/<your-username>/Vaultgram/dist/process.js "$1"
     ```
   - Pass input: as arguments.

Since the script takes a single positional URL argument and never prompts
interactively, it works headlessly from the Shortcut.
