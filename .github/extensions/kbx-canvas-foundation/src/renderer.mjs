import { escapeHtml, normalizeTheme } from './contracts.mjs';

export function renderCanvasDocument(state) {
  const normalizedTheme = normalizeTheme(state && state.theme ? state.theme : 'dark');
  const items = Array.isArray(state && state.items) ? state.items : [];
  const links = Array.isArray(state && state.links) ? state.links : [];
  const status = state && state.status ? state.status : 'ready';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(state && state.title ? state.title : 'KBX canvas')}</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #0b0d12;
        --panel: #171b22;
        --panel-alt: #1f2430;
        --text: #f3f6fb;
        --muted: #b5bfce;
        --accent: #7ea9ff;
        --accent-strong: #5c8cff;
        --border: rgba(255,255,255,0.12);
        --success: #70d6a3;
        --error: #ff8e8e;
        --shadow: rgba(10, 12, 18, 0.26);
      }

      body[data-theme='light'] {
        --bg: #f3f6fb;
        --panel: #ffffff;
        --panel-alt: #edf3fb;
        --text: #1d2430;
        --muted: #5c6676;
        --accent: #3f79ff;
        --accent-strong: #204fd1;
        --border: rgba(0,0,0,0.08);
        --shadow: rgba(23, 31, 41, 0.08);
      }

      body[data-theme='sepia'] {
        --bg: #f4eddc;
        --panel: #fffaf0;
        --panel-alt: #f1e5c5;
        --text: #2b2013;
        --muted: #6a5846;
        --accent: #a7671a;
        --accent-strong: #7c4a15;
        --border: rgba(88,63,33,0.14);
        --shadow: rgba(72, 52, 31, 0.1);
      }

      body[data-theme='ocean'] {
        --bg: #071b2d;
        --panel: #0b2743;
        --panel-alt: #113454;
        --text: #e7f3ff;
        --muted: #a8c7ea;
        --accent: #7fdaf7;
        --accent-strong: #39a9dd;
        --border: rgba(160, 225, 255, 0.2);
        --shadow: rgba(11, 39, 67, 0.22);
      }

      * { box-sizing: border-box; }

      html, body {
        margin: 0;
        min-height: 100%;
        min-width: 100%;
        background: var(--bg);
        color: var(--text);
        font-family: "Segoe UI", sans-serif;
      }

      body {
        min-height: 100vh;
        padding: 1rem;
        background: var(--bg);
      }

      .shell {
        width: min(100%, 72rem);
        margin: 0 auto;
        display: grid;
        gap: 1rem;
      }

      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        box-shadow: 0 0.5rem 1rem var(--shadow);
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
      }

      .title {
        margin: 0;
        font-size: clamp(1.2rem, 2vw, 1.8rem);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      button {
        appearance: none;
        border: 1px solid var(--border);
        background: var(--panel-alt);
        color: var(--text);
        border-radius: 0.5rem;
        padding: 0.65rem 0.9rem;
        font: inherit;
        cursor: pointer;
      }

      button:focus-visible,
      a:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .content {
        display: grid;
        gap: 1rem;
        padding: 0 1.25rem 1.25rem;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        border-radius: 999px;
        padding: 0.35rem 0.7rem;
        border: 1px solid var(--border);
        background: var(--panel-alt);
        color: var(--muted);
        font-size: 0.9rem;
      }

      .status[data-severity='error'] { color: var(--error); }
      .status[data-severity='success'] { color: var(--success); }

      .section {
        display: grid;
        gap: 0.75rem;
      }

      .section h2 {
        margin: 0;
        font-size: 1rem;
      }

      ul {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.65rem;
      }

      .item,
      .link {
        background: var(--panel-alt);
        border: 1px solid var(--border);
        border-radius: 0.65rem;
        padding: 0.8rem 0.9rem;
      }

      .item-header {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        align-items: center;
      }

      .tag {
        display: inline-flex;
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        font-size: 0.74rem;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.04);
      }

      .muted {
        color: var(--muted);
      }

      a {
        color: var(--accent);
        text-decoration: none;
      }

      a:hover { text-decoration: underline; }

      .placeholder {
        background: var(--panel-alt);
        border: 1px dashed var(--border);
        border-radius: 0.75rem;
        padding: 1rem;
        color: var(--muted);
      }

      [hidden] { display: none !important; }
    </style>
  </head>
  <body data-theme="${escapeHtml(normalizedTheme)}">
    <div class="shell">
      <header class="card toolbar">
        <div>
          <h1 class="title">${escapeHtml(state && state.title ? state.title : 'KBX Canvas')}</h1>
        </div>
        <div class="actions">
          <button id="themeToggle" type="button" aria-label="Toggle theme">Toggle theme</button>
          <button id="addItem" type="button" aria-label="Add sample item">Add sample item</button>
        </div>
      </header>

      <div class="card content">
        <div id="loading" class="status" hidden>Loading…</div>
        <div id="error" class="status" data-severity="error" hidden>Unable to load this canvas.</div>
        <div id="empty" class="placeholder" hidden>No items are currently available for this KBX canvas.</div>

        <div id="shell" class="section" hidden>
          <div class="status" data-severity="${status === 'error' ? 'error' : 'success'}">${escapeHtml(status)}</div>
          <div class="section">
            <h2>Items</h2>
            <ul id="items"></ul>
          </div>
          <div class="section">
            <h2>Links</h2>
            <ul id="links"></ul>
          </div>
        </div>
      </div>
    </div>

    <script type="module">
      const root = document.body;
      const loadingEl = document.getElementById('loading');
      const errorEl = document.getElementById('error');
      const emptyEl = document.getElementById('empty');
      const shellEl = document.getElementById('shell');
      const itemListEl = document.getElementById('items');
      const linkListEl = document.getElementById('links');
      const themeToggle = document.getElementById('themeToggle');
      const addItemButton = document.getElementById('addItem');
      const params = new URLSearchParams(window.location.search);
      const artifactId = params.get('artifactId');
      const themeCycle = ['dark', 'light', 'sepia', 'ocean'];

      function renderState(state) {
        if (!state || !state.artifactId) {
          shellEl.hidden = true;
          emptyEl.hidden = false;
          loadingEl.hidden = true;
          errorEl.hidden = true;
          return;
        }

        itemListEl.innerHTML = '';
        linkListEl.innerHTML = '';

        const items = Array.isArray(state.items) ? state.items : [];
        const links = Array.isArray(state.links) ? state.links : [];
        const theme = state.theme || 'dark';
        root.dataset.theme = theme;

        if (items.length === 0) {
          emptyEl.hidden = false;
        } else {
          emptyEl.hidden = true;
          for (const item of items) {
            const li = document.createElement('li');
            li.className = 'item';
            const statusText = item.status ? item.status : 'active';
            const linkHtml = item.url ? \`<a href="\${item.url}" rel="noreferrer noopener">Open</a>\` : '';
            li.innerHTML = \`
              <div class="item-header">
                <strong>\${item.title || 'Untitled item'}</strong>
                <span class="tag">\${statusText}</span>
              </div>
              <div class="muted">\${item.description || ''}</div>
              \${linkHtml}
            \`;
            itemListEl.appendChild(li);
          }
        }

        if (links.length === 0) {
          linkListEl.innerHTML = '<li class="placeholder">No links available.</li>';
        } else {
          for (const link of links) {
            const li = document.createElement('li');
            li.className = 'link';
            li.innerHTML = \`<a href="\${link.href || '#'}" rel="noreferrer noopener">\${link.label || 'Link'}</a>\`;
            linkListEl.appendChild(li);
          }
        }

        document.title = state.title || 'KBX canvas';
        shellEl.hidden = false;
        loadingEl.hidden = true;
        errorEl.hidden = true;
      }

      function handleError() {
        shellEl.hidden = true;
        errorEl.hidden = false;
        loadingEl.hidden = true;
      }

      async function loadState() {
        if (!artifactId) {
          handleError();
          return;
        }

        loadingEl.hidden = false;
        try {
          const response = await fetch(\`/api/canvas/\${encodeURIComponent(artifactId)}\`);
          if (!response.ok) {
            throw new Error('Request failed');
          }
          const state = await response.json();
          renderState(state);
        } catch (error) {
          handleError();
        }
      }

      themeToggle.addEventListener('click', () => {
        const current = root.dataset.theme || 'dark';
        const index = themeCycle.indexOf(current);
        const next = themeCycle[(index + 1) % themeCycle.length];
        root.dataset.theme = next;
        fetch(\`/api/canvas/\${encodeURIComponent(artifactId)}\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'set_theme', payload: { theme: next } }),
        }).catch(() => {});
      });

      addItemButton.addEventListener('click', () => {
        const next = {
          title: 'Follow-up action',
          description: 'Auto-created from the generic canvas shell.',
          status: 'active',
          url: 'https://example.com/next-step',
        };

        fetch(\`/api/canvas/\${encodeURIComponent(artifactId)}\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'append_item', payload: next }),
        }).then(async (response) => {
          if (!response.ok) {
            return;
          }
          const state = await response.json();
          renderState(state);
        }).catch(() => {});
      });

      document.addEventListener('click', (event) => {
        const anchor = event.target.closest('a[href]');
        if (!anchor) {
          return;
        }

        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('javascript:')) {
          event.preventDefault();
        }
      });

      if (artifactId) {
        const source = new EventSource(\`/api/canvas/\${encodeURIComponent(artifactId)}/events\`);
        source.addEventListener('state', (event) => {
          try {
            const message = JSON.parse(event.data);
            renderState(message);
          } catch (error) {
            handleError();
          }
        });
        source.addEventListener('error', () => {
          source.close();
        });
      }

      loadState();
    </script>
  </body>
</html>`;
}
