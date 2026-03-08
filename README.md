# beads-board

A minimal kanban dashboard and git log viewer for [Beads](https://github.com/steveyegge/beads), packaged as a Claude Code plugin.

## Features

- **Kanban board** — Issues organized by status: Ready, In Progress, Blocked, Done
- **Git log** — Scrollable commit history with branch selector
- **Bead ID linking** — Bead IDs in commit messages are highlighted
- **Dark/light theme** — Toggle with dark mode default
- **Auto-refresh** — Polls for updates every 5 seconds
- **Zero runtime dependencies** — Server uses only Node.js stdlib

## Install as Claude Code Plugin

```bash
claude plugin install /path/to/beads-board
```

Then use `/beads-board:open` to launch the dashboard.

## Manual Usage

```bash
# Start the server (from a directory with .beads/)
node server/index.js

# Or specify a project directory
node server/index.js /path/to/your/project
```

Open http://localhost:8377 in your browser.

## Development

```bash
# Install UI dependencies
cd ui && npm install

# Dev server with hot reload (start backend first)
node server/index.js &
cd ui && npm run dev

# Build for production
npm run build
```

## License

MIT
