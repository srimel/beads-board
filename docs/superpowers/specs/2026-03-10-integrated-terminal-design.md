# Integrated Terminal Panel

## Overview

Add a VS Code-style integrated terminal that slides up from the bottom of the kanban area. Uses xterm.js in the browser connected to a real PTY shell via WebSocket, spawned in the project directory.

## Layout

The terminal panel occupies the bottom portion of the **kanban area only** (left of the vertical git-log splitter). It does not extend under the git log panel.

```
┌──────────────────────────────────┬─────────────┐
│                                  │             │
│         Kanban Board             │   Git Log   │
│                                  │             │
├──────────────────────────────────┤             │
│  ═══ draggable resize edge ═══  │             │
│         Terminal (xterm.js)      │             │
│                                  │             │
└──────────────────────────────────┴─────────────┘
```

When collapsed, the terminal is fully hidden (0px height). The shell process stays alive in the background so state is preserved when re-opened.

Default height on first use: 300px. Persisted in localStorage after user resizes.

## Toggle

- **Windows/Linux**: `Ctrl+`` ` ``
- **macOS**: `Cmd+`` ` ``
- Keyboard shortcut registered globally in `App.tsx`
- Small terminal icon button in the top bar for discoverability

## Security

This is a local-only tool. The server binds to `localhost` only. The WebSocket upgrade handler should validate the `Origin` header to reject non-local connections. No authentication is needed for local use.

If the server is exposed via port forwarding, the terminal endpoint grants full shell access — this is by design for a local dev tool, same as VS Code's integrated terminal.

## Architecture

### Server Side

**New file: `server/terminal.js`** — isolated module to keep the core server clean.

- Exports a function that accepts the HTTP server and `PROJECT_DIR`
- Listens for WebSocket upgrade requests on path `/ws/terminal`
- The upgrade handler must be registered on the `server` object via the `'upgrade'` event, not inside `handleRequest`
- On connection: spawns a PTY shell (`bash` on Unix, `powershell.exe` on Windows) with cwd set to `PROJECT_DIR`
- Pipes PTY stdout → WebSocket and WebSocket → PTY stdin
- Handles resize messages from the client to update PTY dimensions
- Cleans up PTY process on WebSocket close
- Hooks into existing `SIGTERM`/`SIGINT` handlers to kill active PTY processes on server shutdown

**Dependencies (root package.json):**
- `node-pty` — native PTY binding. Use `node-pty-prebuilt-multiarch` if available to avoid requiring build tools on end-user machines
- `ws` — WebSocket library

These are the first server-side npm dependencies. CLAUDE.md will be updated to note that `node-pty` and `ws` are required for the terminal feature, while the core dashboard remains stdlib-only.

**Graceful degradation:** If `node-pty` or `ws` fails to load (e.g., user hasn't installed native deps), the rest of beads-board (kanban + git log) works normally. The terminal feature is simply unavailable — the WebSocket upgrade handler is not registered, and the UI button/shortcut shows a "Terminal unavailable" message.

### Client Side

**New file: `ui/src/components/TerminalPanel.tsx`**

- Renders an xterm.js terminal instance
- Connects to `ws://localhost:<port>/ws/terminal` on mount
- Uses `@xterm/addon-fit` to auto-size terminal to container
- Sends user input over WebSocket
- Receives output over WebSocket and writes to xterm
- Sends resize events when panel height changes
- Does NOT unmount xterm when panel is collapsed (preserves terminal state)

**Dependencies (ui/package.json):**
- `@xterm/xterm` — terminal emulator (v5+ scoped package)
- `@xterm/addon-fit` — auto-resize addon

### App.tsx Changes

- New state: `terminalOpen` (boolean), `terminalHeight` (number, default 300px, persisted in localStorage)
- Keyboard listener for `Ctrl/Cmd+`` ` `` to toggle `terminalOpen`
- Layout: kanban area becomes a vertical flex container — `KanbanBoard` on top, `TerminalPanel` on bottom (when open)
- Draggable resize edge between kanban and terminal (same pattern as existing git-log splitter)

## WebSocket Protocol

**Connection:** Client connects to `ws://localhost:<port>/ws/terminal`

**Message types:**

| Direction | Format | Description |
|---|---|---|
| Client → Server | Binary (UTF-8 text) | Terminal input (keystrokes) |
| Client → Server | JSON text: `{ "type": "resize", "cols": N, "rows": N }` | Resize PTY |
| Server → Client | Binary (UTF-8 text) | Terminal output (PTY stdout) |
| Server → Client | JSON text: `{ "type": "exit", "code": N }` | Shell process exited |

The server distinguishes client messages by attempting JSON parse — if it parses as a JSON object with a `type` field, it's a control message; otherwise it's raw terminal input.

## Data Flow

```
Browser xterm.js
    ↕ WebSocket (text frames)
Server terminal.js
    ↕ node-pty
Shell process (bash/powershell)
    cwd: PROJECT_DIR
```

## Resize Handling

1. User drags the terminal resize edge
2. `App.tsx` updates `terminalHeight` state + localStorage
3. `TerminalPanel` detects size change via ResizeObserver
4. Calls `fitAddon.fit()` to recalculate xterm rows/cols
5. Sends new dimensions to server via WebSocket message: `{ "type": "resize", "cols": N, "rows": N }`
6. Server calls `pty.resize(cols, rows)`

## Collapse/Expand

- Collapsing sets terminal panel height to 0 but does NOT disconnect WebSocket or kill PTY
- Expanding restores previous height from localStorage
- xterm re-fits on expand

## Shell Exit

When the shell process exits (user types `exit`, or process terminates):
1. Server sends `{ "type": "exit", "code": N }` to client
2. Client shows "Process exited (code N). Press any key to restart." in the terminal
3. On next keypress, client sends a reconnect — server spawns a new PTY

## Edge Cases

- **Server not running**: Terminal panel shows a "Connecting..." state, retries on interval
- **WebSocket disconnect**: Show reconnect indicator, attempt reconnect
- **Window resize**: Trigger fit recalculation
- **Multiple tabs**: Each tab gets its own PTY session (independent shells)
- **node-pty not installed**: Terminal UI shows "Terminal unavailable" instead of xterm

## File Changes Summary

| File | Change |
|---|---|
| `server/terminal.js` | New — WebSocket + PTY handler |
| `server/index.js` | Wire WebSocket upgrade to terminal.js, hook shutdown cleanup |
| `ui/src/components/TerminalPanel.tsx` | New — xterm.js wrapper + resize |
| `ui/src/App.tsx` | Add terminal state, keyboard shortcut, layout changes |
| `package.json` | Add `node-pty` (or prebuilt variant), `ws` |
| `ui/package.json` | Add `@xterm/xterm`, `@xterm/addon-fit` |
| `CLAUDE.md` | Update dependency note for terminal feature |

## Out of Scope

- Multiple terminal tabs/splits (single session per tab for v1)
- Custom shell selection
- Terminal themes/font customization
- Command history persistence across sessions
