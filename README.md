# beads-board

A minimal kanban dashboard and git log viewer for [Beads](https://github.com/steveyegge/beads). Works standalone as a CLI tool or as a Claude Code plugin.

## Features

- **Kanban board** — Issues organized by status: Ready, In Progress, Blocked, Done
- **Git log** — Scrollable commit history with branch selector
- **Bead ID linking** — Bead IDs in commit messages are highlighted as badges
- **Dark/light theme** — Toggle between themes, dark by default
- **Auto-refresh** — Polls for updates every 5 seconds
- **Zero runtime dependencies** — Server uses only Node.js stdlib

## Quick Start

### Standalone CLI (works with any editor)

```bash
# Install globally
npm install -g @stuart-rimel/beads-ui

# Or run directly with npx
npx @stuart-rimel/beads-ui
```

Then from any project that uses [Beads](https://github.com/steveyegge/beads):

```bash
cd /path/to/your/project
beads-board                     # Start dashboard for current directory
beads-board /path/to/project    # Or specify a project directory
beads-board --port 9000         # Custom port
```

Open **http://localhost:8377** in your browser. The server auto-detects an available port and reuses an existing instance if one is already running.

### As a Claude Code Plugin

```bash
# Install from local directory
claude --plugin-dir /path/to/beads-board

# Then in any project with .beads/
/beads-board:start    # Start the dashboard server
/beads-board:stop     # Stop it
```

The plugin auto-detects `.beads/` in your project. If your project doesn't use Beads, it will let you know.

## How It Works

The server shells out to `bd` and `git` CLI commands to fetch data, then serves a React dashboard that polls the API every 5 seconds. No direct database access — all data flows through the Beads CLI.

```
Browser  →  GET /api/*  →  Node.js server  →  bd/git CLI  →  JSON response
         ←  React app   ←  server/dist/
```

See [docs/architecture.md](docs/architecture.md) for details.

## Documentation

- [Architecture](docs/architecture.md) — How the server, UI, and plugin fit together
- [API Reference](docs/api.md) — All API endpoints with examples
- [Contributing](docs/contributing.md) — How to set up a dev environment and make changes

## License

[MIT](LICENSE)
