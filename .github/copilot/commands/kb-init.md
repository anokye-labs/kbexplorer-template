---
name: kb-init
description: Bootstrap kbexplorer in the current repository. Adds the .kbexplorer submodule, runs the interactive setup wizard, starts the dev server, and validates with playwright-cli. Fully agent-driven — the user only answers configuration questions.
---

# KB Explorer Init

You are bootstrapping kbexplorer for the current repository. You MUST execute every
step below. Do NOT skip validation. Do NOT ask the user to run commands themselves —
you run everything.

## Step 1: Detect Mode

Check if the current repo IS kbexplorer:
- Read `package.json` and check if `name` is `"kbexplorer"`
- If yes → **self-hosted mode** (skip Step 2)
- If no → **submodule mode**

## Step 2: Add Submodule (submodule mode only)

Check if `.kbexplorer/` directory exists:
- If it already exists, skip to Step 3
- If not, run this command yourself:
  ```bash
  git submodule add https://github.com/anokye-labs/kbexplorer.git .kbexplorer
  ```

## Step 3: Run Interactive Init

Run the init wizard. This is the only step where the user provides input
(answering configuration questions interactively):

**Self-hosted mode:**
```bash
node scripts/init.js
```

**Submodule mode:**
```bash
node .kbexplorer/scripts/init.js
```

The wizard asks about content mode, title, branch, visual style, theme, and features.
It automatically installs dependencies and creates all config files.

## Step 4: Start Dev Server (MANDATORY)

After init completes, YOU start the dev server. Do not ask the user to do this.

**Self-hosted mode:**
```bash
npm run dev
```

**Submodule mode:**
```bash
npm run kb:dev
```

Start it as a background/async process. Wait approximately 5 seconds for Vite to start,
then proceed to validation.

## Step 5: Validate with Playwright (MANDATORY)

This step is REQUIRED. You MUST validate that the explorer loaded correctly.

Use the **playwright-cli** skill to:

1. Navigate to `http://localhost:5173`
2. Wait for the page to fully load (wait for network idle or a few seconds)
3. Take a screenshot of the page
4. Evaluate the screenshot using your vision capability:
   - Confirm the page is NOT a blank white/black screen
   - Confirm you can see knowledge base content (cards, graph nodes, titles, or loading indicator)
   - Check for error messages or broken layouts
5. If the page loaded correctly: report success with the screenshot
6. If the page shows errors or is blank: diagnose the issue, check the dev server
   output for errors, and attempt to fix

If playwright-cli is not available as a skill, inform the user:
- "playwright-cli is required for validation. Install the playwright-cli Copilot CLI
  plugin to enable automated browser validation."
- Then open the URL in the user's default browser as a fallback:
  ```bash
  # Windows
  start http://localhost:5173
  # macOS
  open http://localhost:5173
  # Linux
  xdg-open http://localhost:5173
  ```
- Take note that the user needs to visually confirm in this case.

## Step 6: Report Results

Provide a complete summary:
- ✅ Submodule added (or already present, or self-hosted)
- ✅ Configuration created (list the content mode, theme, visual mode chosen)
- ✅ Dependencies installed
- ✅ Dev server running at http://localhost:5173
- ✅ Validation: [screenshot result — what you observed]
- Available commands: `npm run kb:dev`, `npm run kb:build`

If any step failed, report the specific error and what you tried to fix it.
