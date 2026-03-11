# beads-board

A minimal kanban dashboard and git log viewer for [Beads](https://github.com/steveyegge/beads). Runs as a standalone CLI tool.

## Features

- **Kanban board** — Issues organized by status: Ready, In Progress, Blocked, Done
- **Git log** — Scrollable commit history with branch selector
- **Bead ID linking** — Bead IDs in commit messages are highlighted as badges
- **Dark/light theme** — Toggle between themes, dark by default
- **Auto-refresh** — Polls for updates every 5 seconds
- **Integrated terminal** — Built-in terminal panel powered by node-pty and xterm.js
- **Minimal runtime dependencies** — Server uses Node.js stdlib plus `node-pty` and `ws` for the terminal

## Quick Start

```bash
# Install globally
npm install -g @citadel-labs/beads-ui

# Or run directly with npx (installs temporarily)
npx @citadel-labs/beads-ui
```

Then from any project that uses [Beads](https://github.com/steveyegge/beads):

```bash
cd /path/to/your/project
bdui                     # Start dashboard in background, prints URL
bdui /path/to/project    # Specify a project directory
bdui --port 9000         # Custom port
bdui status              # Check if dashboard is running
bdui stop                # Stop the dashboard
```

Or start the server directly:

```bash
node server/index.js
```

The server starts in the background and returns control to your terminal. Open the printed URL (default **http://localhost:8377**) in your browser. Port auto-increments if taken.

## How It Works

The server shells out to `bd` and `git` CLI commands to fetch data, then serves a React dashboard that polls the API every 5 seconds. No direct database access — all data flows through the Beads CLI.

```
Browser  →  GET /api/*  →  Node.js server  →  bd/git CLI  →  JSON response
         ←  React app   ←  server/dist/
```

See [docs/architecture.md](docs/architecture.md) for details.

## Documentation

- [Architecture](docs/architecture.md) — How the server and UI fit together
- [API Reference](docs/api.md) — All API endpoints with examples
- [Contributing](docs/contributing.md) — How to set up a dev environment and make changes

## License

[MIT](LICENSE)
