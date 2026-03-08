---
name: start
description: Start the beads-board dashboard server
---

Start the beads-board server and print the dashboard URL.

## Steps

1. Check if the server is already running:

```bash
cat .beads-board.pid 2>/dev/null
```

If the pidfile exists and the process is alive, just print the URL from the pidfile and stop — the server is already running.

2. If not running, start the server in the background:

```bash
node <plugin-dir>/server/index.js <project-dir> &
```

Replace `<plugin-dir>` with the absolute path to this plugin's directory and `<project-dir>` with the user's current working directory (the project root containing `.beads/`).

3. The server prints `beads-board server running at http://localhost:<port>` to stdout. Tell the user the URL.

4. Tell the user they can stop the server with `/beads-board:stop`.
