---
id: wiki-setup
title: "Installation & Development"
emoji: "Wrench"
cluster: guide
parent: wiki-getting-started
connections:
  - to: cache-system
    description: "uses caching from"
  - to: file-vite.config.ts
    description: "configured by"
---

# Installation & Development

## Prerequisites

- **Node.js 18+** and npm

## Install

```bash
git clone https://github.com/anokye-labs/kbexplorer.git
cd kbexplorer
npm install
```

## Development Server

```bash
npm run dev
```

Vite starts at `http://localhost:5173`. Content is fetched live from the GitHub API — no content build step. Changes to React code hot-reload via Vite HMR.

**HMR caveat:** After structural changes (new files, moved exports), HMR can serve stale code. If behavior doesn't match expectations, kill the server, delete `node_modules/.vite`, and restart.

## Production Build

```bash
npm run build
```

Runs TypeScript type-checking (`tsc -b`) then bundles with Vite to `dist/`.

## Deployment

The app deploys to **Azure Static Web Apps** via GitHub Actions. Push to `main` triggers the workflow. Pull requests get staging previews. The `staticwebapp.config.json` handles SPA routing — all paths rewrite to `index.html`.

## Rate Limits

The GitHub API allows 60 unauthenticated requests/hour. API responses are cached in localStorage for 5 minutes to minimize calls. If rate-limited, the app shows an error screen with guidance.
