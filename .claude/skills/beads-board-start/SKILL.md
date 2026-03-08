---
name: start
description: Start the beads-board dashboard server
---

# Start beads-board

Start the beads-board dashboard server and print the URL.

## Steps

1. Check if the server is already running:

```bash
cat .beads-board.pid 2>/dev/null
```

If the pidfile exists and contains a valid PID, check if the process is alive:

```bash
node -e "const d=JSON.parse(require('fs').readFileSync('.beads-board.pid','utf8')); try{process.kill(d.pid,0);console.log('running on port '+d.port)}catch{console.log('stale')}"
```

If running, tell the user the URL (`http://localhost:<port>`) and stop.

2. If not running, start the server in the background:

```bash
node server/index.js "$(pwd)" &
```

3. The server prints `beads-board server running at http://localhost:<port>`. Tell the user the URL.

4. Tell the user they can stop the server with `/beads-board-stop`.
