---
name: start
description: Start the beads-board dashboard server
---

Start the beads-board server and print the dashboard URL.

## Steps

1. Check that the current project uses Beads:

```bash
ls .beads/ 2>/dev/null
```

If `.beads/` does not exist, tell the user this project doesn't use Beads issue tracking and stop.

2. Check if the server is already running:

```bash
cat .beads-board.pid 2>/dev/null
```

If the pidfile exists and the process is alive, just print the URL from the pidfile and stop — the server is already running.

2. If not running, start the server in the background:

```bash
node ${CLAUDE_PLUGIN_ROOT}/server/index.js "$(pwd)" &
```

3. The server prints `beads-board server running at http://localhost:<port>` to stdout. Tell the user the URL.

4. Tell the user they can stop the server with `/beads-board:stop`.
