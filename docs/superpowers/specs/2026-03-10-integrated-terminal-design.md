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

## Toggle

- **Windows/Linux**: `Ctrl+`` ` ``
- **macOS**: `Cmd+`` ` ``
- Keyboard shortcut registered globally in `App.tsx`
- Optional: small terminal icon button in the top bar for discoverability

## Architecture

### Server Side

**New file: `server/terminal.js`** — isolated module to keep the core server clean.

- Exports a function that accepts the HTTP server and `PROJECT_DIR`
- Listens for WebSocket upgrade requests on path `/ws/terminal`
- On connection: spawns a PTY shell (`bash` on Unix, `cmd.exe`/`powershell.exe` on Windows) with cwd set to `PROJECT_DIR`
- Pipes PTY stdout → WebSocket and WebSocket → PTY stdin
- Handles resize messages from the client to update PTY dimensions
- Cleans up PTY process on WebSocket close

**Dependencies:**
- `node-pty` — native PTY binding (new server dependency)
- `ws` — WebSocket library (or use a minimal stdlib-based WebSocket implementation)

Note: `node-pty` is a native module requiring a build toolchain. This is the only way to get proper color, resize, and interactive program support.

### Client Side

**New file: `ui/src/components/TerminalPanel.tsx`**

- Renders an xterm.js terminal instance
- Connects to `ws://localhost:<port>/ws/terminal` on mount
- Uses `xterm-addon-fit` to auto-size terminal to container
- Sends user input over WebSocket
- Receives output over WebSocket and writes to xterm
- Sends resize events when panel height changes
- Does NOT unmount xterm when panel is collapsed (preserves terminal state)

**Dependencies (ui/):**
- `xterm` — terminal emulator
- `@xterm/addon-fit` — auto-resize addon

### App.tsx Changes

- New state: `terminalOpen` (boolean), `terminalHeight` (number, persisted in localStorage)
- Keyboard listener for `Ctrl/Cmd+`` ` `` to toggle `terminalOpen`
- Layout: kanban area becomes a vertical flex container — `KanbanBoard` on top, `TerminalPanel` on bottom (when open)
- Draggable resize edge between kanban and terminal (same pattern as existing git-log splitter)

## Data Flow

```
Browser xterm.js
    ↕ WebSocket (binary frames)
Server terminal.js
    ↕ node-pty
Shell process (bash/cmd/powershell)
    cwd: PROJECT_DIR
```

## Resize Handling

1. User drags the terminal resize edge
2. `App.tsx` updates `terminalHeight` state + localStorage
3. `TerminalPanel` detects size change via ResizeObserver
4. Calls `fitAddon.fit()` to recalculate xterm rows/cols
5. Sends new dimensions to server via WebSocket message: `{ type: "resize", cols, rows }`
6. Server calls `pty.resize(cols, rows)`

## Collapse/Expand

- Collapsing sets terminal panel height to 0 but does NOT disconnect WebSocket or kill PTY
- Expanding restores previous height from localStorage
- xterm re-fits on expand

## Edge Cases

- **Server not running**: Terminal panel shows a "Connecting..." state, retries on interval
- **WebSocket disconnect**: Show reconnect indicator, attempt reconnect
- **Window resize**: Trigger fit recalculation
- **Multiple tabs**: Each tab gets its own PTY session (independent shells)

## File Changes Summary

| File | Change |
|---|---|
| `server/terminal.js` | New — WebSocket + PTY handler |
| `server/index.js` | Wire WebSocket upgrade to terminal.js |
| `ui/src/components/TerminalPanel.tsx` | New — xterm.js wrapper + resize |
| `ui/src/App.tsx` | Add terminal state, keyboard shortcut, layout changes |
| `server/package.json` | New — add `node-pty`, `ws` dependencies |
| `ui/package.json` | Add `xterm`, `@xterm/addon-fit` |

## Out of Scope

- Multiple terminal tabs/splits (single session per tab for v1)
- Custom shell selection
- Terminal themes/font customization
- Command history persistence across sessions
