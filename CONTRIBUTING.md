# Contributing

Thank you for your interest in contributing to this project.

## Getting Started

1. **File an issue first.** Every change must trace back to a GitHub Issue. Use the appropriate issue type (Epic, Feature, Task, or Bug).
2. **Create a branch.** Work on a feature branch — never commit directly to the default branch.
3. **Open a pull request.** Reference the issue in your PR description.
4. **Resolve all conversations.** All review comments must be resolved before merging.

## Issue Types

| Type | Use When |
|------|----------|
| Epic | Large initiatives spanning multiple features |
| Feature | User-facing capabilities or system components |
| Task | Concrete, actionable work items |
| Bug | Defects and fixes |

Issue types are set via the GitHub Issue Type field, not labels or title prefixes.

For scaffolding a multi-issue program (Epic → Feature → Task, native sub-issues, blocked-by waves), use `.agents/skills/wbs-builder/` — the org's canonical workback-scheduling reference — rather than hand-rolling the hierarchy.

## Development Workflow

1. Clone the repository and create a feature branch
2. Make your changes following existing code conventions
3. Run the build and tests locally before pushing
4. Open a PR and ensure CI passes
5. Address any review feedback

## Code Style

This project uses automated formatting and linting. Check for `.editorconfig`, `ruff.toml`, `.prettierrc.json`, or similar configuration files and ensure your changes conform.

## Branch Protection

The default branch has protection rules enforced:
- Direct pushes are blocked
- All PR conversations must be resolved before merging
- Force pushes and branch deletion are blocked

**Caveat — bot PRs auto-merge at 0 human approvals.** The workflow steps above ("Open a pull request" / "Address any review feedback") describe the flow for human-authored PRs. In practice, `.github/workflows/auto-merge.yml` squash-merges PRs from an allowlist of agent authors (currently `devin-ai-integration[bot]`, `copilot-swe-agent[bot]`, `Copilot`) as soon as the ruleset's required checks are green and conversations are resolved — no human approval is requested or required for those PRs. Human-authored PRs are never auto-merged. Verify the live ruleset before assuming a specific approval count applies.