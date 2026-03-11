# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

beads-board is a standalone CLI tool that provides a minimal kanban dashboard + git log viewer for [Beads](https://github.com/steveyegge/beads). It runs as a local HTTP server launched via the `bdui` command or `node server/index.js`. Read-only in v1.

## Architecture

```
bdui / node server/index.js  →  starts server  →  prints URL
                                      │
                                      ▼
                      Local HTTP Server (Node.js stdlib only)
                      ├── GET /api/*  → spawns bd/git CLI
                      └── GET /       → serves built React app
```

- **`server/index.js`** — Node.js HTTP server using only stdlib (`node:http`, `node:child_process`). Zero npm runtime dependencies. Serves the built React app and exposes API endpoints that shell out to `bd` and `git` CLI commands.
- **`ui/`** — React + TypeScript app built with Vite. Uses shadcn/ui components and Tailwind CSS. Builds to `server/dist/` (committed to repo so end users skip the build step).
- **`bin/beads-board.js`** — CLI entry point for the `bdui` command.

Data flows: UI polls API endpoints every 5s → server spawns `bd <cmd> --json` or `git` → returns parsed JSON.

## Build Commands

```bash
# Install UI dependencies
cd ui && npm install

# Build UI (outputs to server/dist/)
npm run build          # from root, or:
cd ui && npm run build

# Dev server with hot reload
cd ui && npm run dev

# Start the backend server directly
node server/index.js
```

## Key Conventions

- **Conventional Commits** — always use the [Conventional Commits](https://www.conventionalcommits.org/) format: `type(scope): description` (e.g. `feat: add celebration animation`, `fix(server): increase bd list limit`). Common types: `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `test`.
- **No Co-Authored-By in commits** — never add `Co-Authored-By` lines to commit messages.
- **Server has minimal npm dependencies** — `node-pty` and `ws` are required for the integrated terminal. The core dashboard (kanban + git log) uses only Node.js stdlib and works without these dependencies.
- **Built assets in `server/dist/` are committed** — rebuild and commit after UI changes.
- **All data access goes through CLI** — use `bd <command> --json` and `git` commands, never direct DB/Dolt access.
- **shadcn/ui for all UI components** — reference LLM-optimized docs at https://ui.shadcn.com/llms.txt when doing UI work.
- **Dark theme by default** using shadcn's CSS class dark mode strategy.
- **Default port is 8377** — increment if taken. Server writes a pidfile to detect if already running.
- **Issue tracking uses bd (beads)** — see `AGENTS.md` for the full bd workflow. Never use markdown TODOs.

## API Endpoints

All API endpoints are in `server/index.js`:

| Endpoint | Source Command |
|---|---|
| `GET /api/issues` | `bd list --json` |
| `GET /api/ready` | `bd ready --json` |
| `GET /api/blocked` | `bd blocked --json` |
| `GET /api/issue/:id` | `bd show <id> --json` |
| `GET /api/git-log?branch=&limit=50` | `git log` with JSON format |
| `GET /api/branches` | `git branch` |
| `WS /ws/terminal` | node-pty shell | WebSocket PTY stream |

## Beads Data Model

Each issue has: `id` (hash-based, e.g. `bd-a1b2`), `title`, `status`, `priority` (P0–P4), `type` (task/bug/feature/epic/chore), `dependencies`, `assignee`, `labels`, and `description`.

## Kanban Column Mapping

| Bead Status | Column | Color Accent |
|---|---|---|
| not ready, in_progress, or closed | Backlog | Slate |
| `open` (no blockers) | Ready | Green |
| `in_progress` | In Progress | Blue |
| `closed` | Done | Muted/Gray |

"Ready" uses `bd ready --json` (open issues with no unresolved blockers). "Backlog" is everything else that isn't in_progress or closed (includes blocked, deferred, open-with-blockers).

## UI Layout

- **Top bar**: project name, auto-refresh indicator, last updated timestamp
- **Left ~65%**: `KanbanBoard` → four `KanbanColumn` components (Ready, In Progress, Blocked, Done)
- **Right ~35%**: `GitLog` with `BranchSelector` dropdown and scrollable commit list
- Bead IDs in commit messages (regex matching project prefix pattern) render as highlighted Badge elements

## Implementation Plan

Full phased roadmap is in `docs/beads-board-plan.md`.
