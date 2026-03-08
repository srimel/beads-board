---
name: stop
description: Stop the beads-board dashboard server
---

Stop a running beads-board server.

## Steps

1. Read the pidfile to get the server's PID:

```bash
cat .beads-board.pid
```

If the pidfile doesn't exist, tell the user the server is not running and stop.

2. Kill the server process:

```bash
kill $(node -e "console.log(JSON.parse(require('fs').readFileSync('.beads-board.pid','utf8')).pid)")
```

3. Verify the pidfile was cleaned up (the server removes it on SIGTERM):

```bash
ls .beads-board.pid 2>/dev/null
```

If it still exists, remove it manually:

```bash
rm -f .beads-board.pid
```

4. Tell the user the server has been stopped.
