export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Vaultgram</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    color-scheme: light dark;
    --bg: #0f1115;
    --panel: #171a21;
    --border: #2a2e38;
    --text: #e7e9ee;
    --muted: #8b93a3;
    --accent: #5b8cff;
    --danger: #ff6b6b;
    --ok: #4caf50;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f5f6f8;
      --panel: #ffffff;
      --border: #dde1e8;
      --text: #1a1d23;
      --muted: #5b6472;
      --accent: #3b6fe0;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
  }
  .wrap { max-width: 880px; margin: 0 auto; padding: 32px 20px 80px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .subtitle { color: var(--muted); font-size: 14px; margin: 0 0 28px; }
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px 20px;
    margin-bottom: 24px;
  }
  .panel h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 0 0 12px; }
  form.job { display: flex; gap: 8px; }
  input[type=text], input[type=url] {
    flex: 1;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text);
    font-size: 14px;
  }
  button {
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 18px;
    font-size: 14px;
    cursor: pointer;
  }
  button:disabled { opacity: .5; cursor: not-allowed; }
  #log {
    display: none;
    margin-top: 14px;
    background: rgba(0,0,0,.25);
    border-radius: 8px;
    padding: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    max-height: 220px;
    overflow-y: auto;
    white-space: pre-wrap;
  }
  #log .err { color: var(--danger); }
  #log .ok { color: var(--ok); }
  .toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
  .toolbar input[type=text] { max-width: 260px; }
  .chip {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 12.5px;
    cursor: pointer;
    color: var(--muted);
    background: transparent;
  }
  .chip.active { background: var(--accent); color: white; border-color: var(--accent); }
  .note-card {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 10px;
    cursor: pointer;
  }
  .note-card:hover { border-color: var(--accent); }
  .note-title { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
  .note-meta { display: flex; gap: 10px; align-items: center; font-size: 12.5px; color: var(--muted); flex-wrap: wrap; }
  .note-tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { background: rgba(91,140,255,.14); color: var(--accent); border-radius: 999px; padding: 2px 8px; font-size: 11.5px; }
  .empty { color: var(--muted); font-size: 14px; padding: 20px 0; text-align: center; }
  .modal-overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,.5);
    align-items: flex-start;
    justify-content: center;
    padding: 40px 16px;
    overflow-y: auto;
  }
  .modal-overlay.open { display: flex; }
  .modal {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    max-width: 640px;
    width: 100%;
    padding: 24px 28px;
  }
  .modal-close { float: right; background: transparent; color: var(--muted); border: 1px solid var(--border); padding: 4px 10px; }
  .modal h1 { font-size: 19px; }
  .modal h2 { font-size: 14px; margin-top: 20px; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
  .modal ul { padding-left: 20px; }
  .modal blockquote { border-left: 3px solid var(--border); margin: 8px 0; padding: 4px 12px; color: var(--muted); }
  .modal details { margin-top: 6px; }
  .modal a.source-link { display: inline-block; margin-top: 4px; font-size: 12.5px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Vaultgram</h1>
  <p class="subtitle" id="subtitle">Instagram → transcript → summary → Obsidian note</p>

  <div class="panel">
    <h2>New note</h2>
    <form class="job" id="job-form">
      <input type="url" id="job-url" placeholder="https://www.instagram.com/reel/..." required>
      <button type="submit" id="job-submit">Process</button>
    </form>
    <div id="log"></div>
  </div>

  <div class="panel">
    <h2>Notes</h2>
    <div class="toolbar">
      <input type="text" id="search" placeholder="Search titles...">
      <div id="tag-chips" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
    </div>
    <div id="notes-list"></div>
  </div>
</div>

<div class="modal-overlay" id="modal-overlay">
  <div class="modal">
    <button class="modal-close" id="modal-close">Close</button>
    <div id="modal-body"></div>
  </div>
</div>

<script>
  let allNotes = [];
  let activeTag = null;

  async function fetchNotes() {
    const res = await fetch('/api/notes');
    allNotes = await res.json();
    document.getElementById('subtitle').textContent =
      allNotes.length + ' note' + (allNotes.length === 1 ? '' : 's') + ' in the vault';
    renderTagChips();
    renderNotes();
  }

  function renderTagChips() {
    const tagSet = new Set();
    allNotes.forEach(n => n.tags.forEach(t => tagSet.add(t)));
    const container = document.getElementById('tag-chips');
    container.innerHTML = '';
    [...tagSet].sort().forEach(tag => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (activeTag === tag ? ' active' : '');
      chip.textContent = tag;
      chip.onclick = () => { activeTag = activeTag === tag ? null : tag; renderTagChips(); renderNotes(); };
      container.appendChild(chip);
    });
  }

  function renderNotes() {
    const query = document.getElementById('search').value.trim().toLowerCase();
    const list = document.getElementById('notes-list');
    list.innerHTML = '';

    const filtered = allNotes.filter(n => {
      const matchesQuery = !query || n.title.toLowerCase().includes(query);
      const matchesTag = !activeTag || n.tags.includes(activeTag);
      return matchesQuery && matchesTag;
    });

    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty">No notes match.</div>';
      return;
    }

    filtered.forEach(note => {
      const card = document.createElement('div');
      card.className = 'note-card';
      card.onclick = () => openNote(note.filename);

      const title = document.createElement('div');
      title.className = 'note-title';
      title.textContent = note.title;

      const meta = document.createElement('div');
      meta.className = 'note-meta';

      const date = document.createElement('span');
      date.textContent = note.date;
      meta.appendChild(date);

      const tags = document.createElement('div');
      tags.className = 'note-tags';
      note.tags.forEach(t => {
        const chip = document.createElement('span');
        chip.className = 'tag';
        chip.textContent = t;
        tags.appendChild(chip);
      });
      meta.appendChild(tags);

      card.appendChild(title);
      card.appendChild(meta);
      list.appendChild(card);
    });
  }

  async function openNote(filename) {
    const res = await fetch('/api/notes/' + encodeURIComponent(filename));
    if (!res.ok) return;
    const data = await res.json();
    const note = allNotes.find(n => n.filename === filename);

    const body = document.getElementById('modal-body');
    body.innerHTML = data.bodyHtml;
    if (note && note.source) {
      const link = document.createElement('a');
      link.className = 'source-link';
      link.href = note.source;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Open on Instagram ->';
      body.prepend(link);
    }
    document.getElementById('modal-overlay').classList.add('open');
  }

  document.getElementById('modal-close').onclick = () => {
    document.getElementById('modal-overlay').classList.remove('open');
  };
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') e.currentTarget.classList.remove('open');
  });

  document.getElementById('search').addEventListener('input', renderNotes);

  const form = document.getElementById('job-form');
  const submitBtn = document.getElementById('job-submit');
  const logEl = document.getElementById('log');

  function logLine(text, cls) {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = text;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = document.getElementById('job-url').value.trim();
    if (!url) return;

    submitBtn.disabled = true;
    logEl.style.display = 'block';
    logEl.innerHTML = '';
    logLine('Starting: ' + url);

    const source = new EventSource('/api/process?url=' + encodeURIComponent(url));

    source.addEventListener('progress', (e) => {
      logLine(JSON.parse(e.data));
    });
    source.addEventListener('done', (e) => {
      const data = JSON.parse(e.data);
      logLine('Done. Note written to: ' + data.notePath, 'ok');
      submitBtn.disabled = false;
      source.close();
      document.getElementById('job-url').value = '';
      fetchNotes();
    });
    source.addEventListener('failed', (e) => {
      logLine('Error: ' + JSON.parse(e.data), 'err');
      submitBtn.disabled = false;
      source.close();
    });
    source.addEventListener('error', () => {
      if (source.readyState === EventSource.CLOSED) return;
      logLine('Connection to server lost.', 'err');
      submitBtn.disabled = false;
      source.close();
    });
  });

  fetchNotes();
</script>
</body>
</html>
`;
