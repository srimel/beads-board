---
name: stop
description: Stop the beads-board dashboard server. Use when the user wants to shut down the kanban dashboard.
---

# Stop beads-board

Stop a running beads-board server.

## Steps

1. Check if the pidfile exists:

```bash
cat .beads-board.pid 2>/dev/null
```

If the pidfile doesn't exist, tell the user the server is not running and stop.

2. Kill the server process:

```bash
kill $(node -e "console.log(JSON.parse(require('fs').readFileSync('.beads-board.pid','utf8')).pid)")
```

3. Verify the pidfile was cleaned up:

```bash
ls .beads-board.pid 2>/dev/null
```

If it still exists, remove it:

```bash
rm -f .beads-board.pid
```

4. Tell the user the server has been stopped.
