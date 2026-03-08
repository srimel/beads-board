---
name: start
description: Start the beads-board dashboard server. Use when the user wants to view their kanban board or issue dashboard.
---

# Start beads-board

Start the beads-board dashboard server and print the URL.

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

If the pidfile exists and contains a valid PID, check if the process is alive:

```bash
node -e "const d=JSON.parse(require('fs').readFileSync('.beads-board.pid','utf8')); try{process.kill(d.pid,0);console.log('running on port '+d.port)}catch{console.log('stale')}"
```

If running, tell the user the URL (`http://localhost:<port>`) and stop.

3. If not running, start the server in the background:

```bash
node ${CLAUDE_PLUGIN_ROOT}/server/index.js "$(pwd)" &
```

4. The server prints `beads-board server running at http://localhost:<port>`. Tell the user the URL.

5. Tell the user they can stop the server with `/beads-board:stop`.
