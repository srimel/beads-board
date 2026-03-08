---
name: open
description: Launch the beads-board dashboard in your browser
---

Start the beads-board server and open the dashboard:

1. Check if the server is already running by looking for a pidfile at `.beads-board.pid` in the project root
2. If not running, start it: `node <plugin-dir>/server/index.js <project-dir>`
3. The server will print the URL (default: http://localhost:8377)
4. Open that URL in the user's default browser
5. Tell the user the dashboard is running and how to stop it (Ctrl+C or kill the process)
