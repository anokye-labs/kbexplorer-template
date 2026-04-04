# kbexplorer

Interactive Knowledge Base Explorer by [Anokye Labs](https://github.com/anokye-labs).

A React + TypeScript application that presents knowledge as an explorable graph. Navigate topics through an interactive constellation, a card grid, or deep-dive reading views — with a persistent HUD for orientation.

## Content Modes

- **Repo-aware** (default) — explores a GitHub repository's issues, PRs, source files, and docs as a knowledge graph
- **Authored** — renders hand-written markdown files with YAML frontmatter as an interactive knowledge base

## Visual Identity

Four visual modes for node presentation:

| Mode | Assets | Best For |
|------|--------|----------|
| `sprites` | Character illustrations | Technical walkthroughs, branded docs |
| `heroes` | Full-bleed photography | Essays, narratives, editorial |
| `emoji` | Unicode emoji | Lightweight, text-focused |
| `none` | Text only | Minimal deployments |

## Stack

- React + TypeScript (Vite)
- vis-network for graph visualization
- GitHub API for content (runtime fetch, no build step)
- Azure for hosting

## Development

```bash
npm install
npm run dev
```

## License

MIT
