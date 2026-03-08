# Architecture

## Overview

beads-board is a read-only dashboard that visualizes Beads issues as a kanban board alongside a git log. It runs as a local HTTP server.

## System Diagram

```
┌─────────────────────────────────────────────────┐
│  Browser                                        │
│  React app polls every 5s                       │
│  ├── KanbanBoard (Ready, In Progress,           │
│  │   Blocked, Done)                             │
│  └── GitLog (branch selector, commit list)      │
└──────────────────┬──────────────────────────────┘
                   │ GET /api/*
                   ▼
┌─────────────────────────────────────────────────┐
│  Node.js HTTP Server (server/index.js)          │
│  stdlib only: node:http, node:fs,               │
│  node:child_process, node:path, node:url        │
│                                                 │
│  ├── API routes → spawn bd/git CLI              │
│  └── Static files → serve server/dist/          │
└──────────────────┬──────────────────────────────┘
                   │ execFile()
                   ▼
┌─────────────────────────────────────────────────┐
│  bd CLI          │  git CLI                     │
│  bd list --json  │  git log --format=...        │
│  bd ready --json │  git branch --format=...     │
│  bd blocked      │  git rev-parse               │
└─────────────────────────────────────────────────┘
```

## Key Design Decisions

### CLI over direct database access

All data comes from `bd <command> --json` and `git` CLI calls. The Beads CLI is the stable integration surface — we never query Dolt/SQL directly. If the Beads schema changes, `bd` handles it.

### Zero server dependencies

The server uses only Node.js stdlib modules. No Express, no Fastify, no npm install required to run the server. This keeps installation trivial: just `node server/index.js`.

### Pre-built UI assets

The React app builds to `server/dist/` and the built files are committed to the repo. End users never need to run `npm install` or `npm run build` — the server serves the pre-built assets directly.

### Polling over WebSockets

The UI polls API endpoints every 5 seconds. WebSockets would require a dependency or significant custom code. For a local, single-user dev tool, polling is simpler and sufficient.

## Directory Structure

```
beads-board/
├── server/
│   ├── index.js              # HTTP server + API (single file, stdlib only)
│   └── dist/                 # Built React app (committed)
├── ui/
│   ├── src/
│   │   ├── App.tsx           # Root layout: kanban + git log
│   │   ├── components/       # React components
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── BeadCard.tsx
│   │   │   ├── GitLog.tsx
│   │   │   ├── CommitEntry.tsx
│   │   │   ├── BranchSelector.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── hooks/            # React hooks
│   │   │   ├── usePolling.ts
│   │   │   ├── useBeadsApi.ts
│   │   │   └── useTheme.ts
│   │   └── lib/
│   │       ├── types.ts      # TypeScript interfaces
│   │       └── utils.ts      # shadcn cn() helper
│   └── components/ui/        # shadcn/ui components
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── skills/                   # Plugin skills (model-invoked)
│   ├── beads-board-start/SKILL.md
│   └── beads-board-stop/SKILL.md
├── commands/                 # Plugin commands (user-triggered)
│   ├── start.md
│   └── stop.md
└── docs/
    ├── architecture.md
    ├── api.md
    └── contributing.md
```

## Data Flow

1. **UI mounts** → fetches all API endpoints, shows skeleton placeholders
2. **Server receives request** → routes to handler → spawns `bd` or `git` as a child process
3. **CLI returns** → server parses output (JSON from bd, custom format from git) → sends JSON response
4. **UI updates** → React re-renders with new data
5. **Every 5 seconds** → polling hooks re-fetch all endpoints

## Kanban Column Mapping

| Bead Status | Column | Source |
|---|---|---|
| `open` (no blockers) | Ready | `bd ready --json` |
| `in_progress` | In Progress | `bd list --json`, filtered |
| `blocked` | Blocked | `bd blocked --json` |
| `closed` | Done | `bd list --json`, filtered |
