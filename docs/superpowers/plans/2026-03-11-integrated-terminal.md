# Integrated Terminal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a VS Code-style integrated terminal that slides up from the bottom of the kanban area, connected to a real shell via WebSocket + node-pty.

**Architecture:** Server-side `terminal.js` module manages PTY processes and WebSocket connections, wired into the existing HTTP server via the `upgrade` event. Client-side `TerminalPanel.tsx` renders xterm.js in a resizable panel within the kanban area of `App.tsx`.

**Tech Stack:** node-pty, ws, @xterm/xterm, @xterm/addon-fit

**Spec:** `docs/superpowers/specs/2026-03-10-integrated-terminal-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `server/terminal.js` | New — WebSocket upgrade handler, PTY lifecycle, message routing |
| `server/index.js` | Modify — wire terminal module into server, update shutdown handlers |
| `ui/src/components/TerminalPanel.tsx` | New — xterm.js container, WebSocket client, resize handling |
| `ui/src/App.tsx` | Modify — terminal state, keyboard shortcut, layout with terminal panel |
| `ui/vite.config.ts` | Modify — add WebSocket proxy for dev server |
| `package.json` | Modify — add `node-pty`, `ws` dependencies |
| `ui/package.json` | Modify — add `@xterm/xterm`, `@xterm/addon-fit` |
| `CLAUDE.md` | Modify — update dependency documentation |

---

## Chunk 1: Server-Side Terminal Module

### Task 1: Install server dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install node-pty and ws**

Run:
```bash
cd D:/beads-board && npm install node-pty ws
```

- [ ] **Step 2: Verify installation**

Run:
```bash
node -e "require('node-pty'); require('ws'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add node-pty and ws dependencies for terminal feature"
```

---

### Task 2: Create server/terminal.js

**Files:**
- Create: `server/terminal.js`

- [ ] **Step 1: Write the terminal module**

```javascript
const url = require('node:url');

let pty, WebSocket;
try {
  pty = require('node-pty');
  WebSocket = require('ws');
} catch {
  // Dependencies not available — terminal feature disabled
}

const activePtys = new Set();

function getShell() {
  return process.platform === 'win32' ? 'powershell.exe' : 'bash';
}

/**
 * Attach terminal WebSocket handling to an HTTP server.
 * Returns false if dependencies are missing (graceful degradation).
 */
function attachTerminal(httpServer, projectDir) {
  if (!pty || !WebSocket) {
    console.log('Terminal dependencies not available — terminal feature disabled');
    return false;
  }

  const wss = new WebSocket.Server({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const parsed = url.parse(req.url);
    if (parsed.pathname !== '/ws/terminal') {
      socket.destroy();
      return;
    }

    // Origin validation — local connections only
    const origin = req.headers.origin || '';
    if (origin && !origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    const shell = getShell();
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: projectDir,
      env: process.env,
    });

    activePtys.add(ptyProcess);

    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      activePtys.delete(ptyProcess);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      }
    });

    ws.on('message', (msg) => {
      const str = msg.toString();
      try {
        const parsed = JSON.parse(str);
        if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch {
        // Not JSON — raw terminal input
      }
      ptyProcess.write(str);
    });

    ws.on('close', () => {
      activePtys.delete(ptyProcess);
      ptyProcess.kill();
    });
  });

  return true;
}

function cleanupAllPtys() {
  for (const p of activePtys) {
    try { p.kill(); } catch {}
  }
  activePtys.clear();
}

module.exports = { attachTerminal, cleanupAllPtys };
```

- [ ] **Step 2: Verify module loads without errors**

Run:
```bash
node -e "const t = require('./server/terminal.js'); console.log(typeof t.attachTerminal)"
```
Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add server/terminal.js
git commit -m "feat(server): add terminal WebSocket + PTY module"
```

---

### Task 3: Wire terminal into server/index.js

**Files:**
- Modify: `server/index.js` (lines 1-5 for require, lines 303-322 for startup/shutdown)

- [ ] **Step 1: Add require at top of server/index.js**

After the existing requires (line 5), add:
```javascript
const { attachTerminal, cleanupAllPtys } = require('./terminal.js');
```

- [ ] **Step 2: Wire terminal after server creation**

After line 303 (`const server = http.createServer(handleRequest);`), add:
```javascript
const terminalEnabled = attachTerminal(server, PROJECT_DIR);
if (terminalEnabled) {
  console.log('Terminal feature enabled');
}
```

- [ ] **Step 3: Update shutdown handlers to clean up PTYs**

Replace lines 319-320:
```javascript
process.on('SIGTERM', () => { removePidfile(); process.exit(0); });
process.on('SIGINT', () => { removePidfile(); process.exit(0); });
```

With:
```javascript
process.on('SIGTERM', () => { cleanupAllPtys(); removePidfile(); process.exit(0); });
process.on('SIGINT', () => { cleanupAllPtys(); removePidfile(); process.exit(0); });
```

- [ ] **Step 4: Test server starts with terminal enabled**

Run:
```bash
cd D:/beads-board && node -e "
const http = require('http');
const { attachTerminal } = require('./server/terminal.js');
const s = http.createServer((req, res) => res.end('ok'));
const ok = attachTerminal(s, '.');
console.log('terminal attached:', ok);
s.listen(0, () => { s.close(); });
"
```
Expected: `terminal attached: true`

- [ ] **Step 5: Commit**

```bash
git add server/index.js
git commit -m "feat(server): wire terminal module into HTTP server"
```

---

## Chunk 2: Client-Side Terminal UI

### Task 4: Install UI dependencies

**Files:**
- Modify: `ui/package.json`

- [ ] **Step 1: Install xterm packages**

Run:
```bash
cd D:/beads-board/ui && npm install @xterm/xterm @xterm/addon-fit
```

- [ ] **Step 2: Commit**

```bash
git add ui/package.json ui/package-lock.json
git commit -m "chore(ui): add xterm.js dependencies for terminal"
```

---

### Task 5: Add WebSocket proxy to Vite dev config

**Files:**
- Modify: `ui/vite.config.ts` (line 19-21, proxy section)

- [ ] **Step 1: Add WebSocket proxy**

Replace the proxy section:
```typescript
proxy: {
  '/api': 'http://localhost:8377',
},
```

With:
```typescript
proxy: {
  '/api': 'http://localhost:8377',
  '/ws': {
    target: 'ws://localhost:8377',
    ws: true,
  },
},
```

- [ ] **Step 2: Commit**

```bash
git add ui/vite.config.ts
git commit -m "chore(ui): add WebSocket proxy for terminal in dev mode"
```

---

### Task 6: Create TerminalPanel component

**Files:**
- Create: `ui/src/components/TerminalPanel.tsx`

- [ ] **Step 1: Write the TerminalPanel component**

```tsx
import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalPanelProps {
  visible: boolean
}

export function TerminalPanel({ visible }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const initializedRef = useRef(false)
  const exitedRef = useRef(false)

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`)
    wsRef.current = ws
    exitedRef.current = false

    ws.onopen = () => {
      const terminal = terminalRef.current
      const fitAddon = fitAddonRef.current
      if (terminal && fitAddon) {
        // Send initial size
        fitAddon.fit()
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }))
      }
    }

    ws.onmessage = (event) => {
      const data = event.data
      try {
        const msg = JSON.parse(data)
        if (msg.type === 'exit') {
          exitedRef.current = true
          terminalRef.current?.writeln(
            `\r\n\x1b[90mProcess exited (code ${msg.code}). Press any key to restart.\x1b[0m`
          )
          return
        }
      } catch {
        // Not JSON — terminal output
      }
      terminalRef.current?.write(data)
    }

    ws.onclose = () => {
      if (!exitedRef.current) {
        terminalRef.current?.writeln('\r\n\x1b[90mDisconnected. Reconnecting...\x1b[0m')
        setTimeout(connect, 2000)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return
    initializedRef.current = true

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#e6edf3',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39d353',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d364',
        brightWhite: '#f0f6fc',
      },
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    terminal.onData((data) => {
      if (exitedRef.current) {
        // Restart on any keypress after exit
        exitedRef.current = false
        terminal.clear()
        wsRef.current?.close()
        connect()
        return
      }
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    connect()

    return () => {
      wsRef.current?.close()
      terminal.dispose()
    }
  }, [connect])

  // Refit when visibility changes or container resizes
  useEffect(() => {
    if (!visible || !containerRef.current) return
    const fitAddon = fitAddonRef.current
    if (!fitAddon) return

    // Fit after layout settles
    const timer = setTimeout(() => {
      fitAddon.fit()
      const terminal = terminalRef.current
      const ws = wsRef.current
      if (terminal && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }))
      }
    }, 50)

    const observer = new ResizeObserver(() => {
      fitAddon.fit()
      const terminal = terminalRef.current
      const ws = wsRef.current
      if (terminal && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }))
      }
    })
    observer.observe(containerRef.current)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [visible])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ display: visible ? 'block' : 'none' }}
    />
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd D:/beads-board/ui && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors related to TerminalPanel

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/TerminalPanel.tsx
git commit -m "feat(ui): add TerminalPanel component with xterm.js"
```

---

## Chunk 3: App.tsx Integration

### Task 7: Add terminal state, keyboard shortcut, and layout to App.tsx

**Files:**
- Modify: `ui/src/App.tsx`

- [ ] **Step 1: Add imports**

Add to the existing imports at the top of `App.tsx`:
```typescript
import { TerminalPanel } from '@/components/TerminalPanel'
import { TerminalSquare } from 'lucide-react'
```

- [ ] **Step 2: Add terminal state**

After the `highlightTimerRef` line (line 35), add:
```typescript
const [terminalOpen, setTerminalOpen] = useState(() => {
  return localStorage.getItem('beads-board-terminal-open') === 'true'
})
const [terminalHeight, setTerminalHeight] = useState(() => {
  const saved = localStorage.getItem('beads-board-terminal-height')
  return saved ? Number(saved) : 300
})
```

- [ ] **Step 3: Add keyboard shortcut**

After the `useEffect` for `document.title` (around line 151), add:
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === '`' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      setTerminalOpen(prev => {
        const next = !prev
        localStorage.setItem('beads-board-terminal-open', String(next))
        return next
      })
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

- [ ] **Step 4: Add terminal toggle button in top bar**

After the DependencyGraph toggle button (the `<Network>` button), add:
```tsx
<button
  onClick={() => setTerminalOpen(prev => {
    const next = !prev
    localStorage.setItem('beads-board-terminal-open', String(next))
    return next
  })}
  className={`rounded-md p-2 transition-colors ${
    terminalOpen
      ? 'bg-primary/15 text-primary hover:bg-primary/25'
      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
  }`}
  title={terminalOpen ? 'Hide terminal (Ctrl+`)' : 'Show terminal (Ctrl+`)'}
>
  <TerminalSquare className="h-4 w-4" />
</button>
```

- [ ] **Step 5: Add draggable terminal resize edge and panel to kanban layout**

Replace the kanban `<div>` section (lines 208-223) with a vertical flex container that includes the kanban board on top and the terminal panel on bottom:

```tsx
<div
  ref={kanbanRef}
  style={gitLogCollapsed
    ? { width: `calc(100% - ${COLLAPSED_WIDTH_PX}px - 4px)` }
    : { width: `${splitPercent}%` }
  }
  className="flex flex-col overflow-hidden transition-[width] duration-200"
>
  {/* Kanban board — takes remaining space */}
  <div className="flex-1 min-h-0 pl-3 pt-3 pb-3 pr-0 overflow-hidden">
    <KanbanBoard
      issues={filteredIssues}
      ready={filteredReady}
      blocked={filteredBlocked}
      loading={loading}
      onIssueClick={handleIssueClick}
    />
  </div>

  {/* Terminal resize edge + panel */}
  {terminalOpen && (
    <>
      <div
        className="h-1 cursor-row-resize hover:bg-border active:bg-primary/50 shrink-0 transition-colors border-t border-border"
        onMouseDown={(e) => {
          e.preventDefault()
          const kanban = kanbanRef.current
          if (!kanban) return
          const startY = e.clientY
          const startHeight = terminalHeight

          const onMouseMove = (e: MouseEvent) => {
            const delta = startY - e.clientY
            const newHeight = Math.max(100, Math.min(startHeight + delta, window.innerHeight * 0.7))
            setTerminalHeight(newHeight)
            localStorage.setItem('beads-board-terminal-height', String(newHeight))
          }

          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
          }

          document.body.style.cursor = 'row-resize'
          document.body.style.userSelect = 'none'
          document.addEventListener('mousemove', onMouseMove)
          document.addEventListener('mouseup', onMouseUp)
        }}
      />
      <div style={{ height: `${terminalHeight}px` }} className="shrink-0">
        <TerminalPanel visible={terminalOpen} />
      </div>
    </>
  )}
</div>
```

- [ ] **Step 6: Verify it compiles**

Run:
```bash
cd D:/beads-board/ui && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add ui/src/App.tsx
git commit -m "feat(ui): integrate terminal panel into kanban layout with keyboard shortcut"
```

---

## Chunk 4: Build, Polish, and Documentation

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Key Conventions**

In the Key Conventions section, change:
```
- **Server has zero npm dependencies** — only Node.js stdlib. Keep it that way.
```
To:
```
- **Server has minimal npm dependencies** — `node-pty` and `ws` are required for the integrated terminal. The core dashboard (kanban + git log) uses only Node.js stdlib and works without these dependencies.
```

- [ ] **Step 2: Add terminal to API Endpoints table**

Add a row:
```
| `WS /ws/terminal` | node-pty shell | WebSocket PTY stream |
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for terminal dependencies"
```

---

### Task 9: Build and verify end-to-end

- [ ] **Step 1: Build the UI**

Run:
```bash
cd D:/beads-board && npm run build
```

- [ ] **Step 2: Start the server and test terminal in browser**

Run:
```bash
node server/index.js
```

Open `http://localhost:8377`, press `Ctrl+`` ` `` to open terminal, verify shell works.

- [ ] **Step 3: Test keyboard shortcut toggles panel**

Press `Ctrl+`` ` `` again to close, then again to open. Verify terminal state persists.

- [ ] **Step 4: Test resize by dragging the top edge**

Drag the resize bar up and down. Verify terminal reflows text correctly.

- [ ] **Step 5: Commit built assets**

```bash
git add server/dist/
git commit -m "chore: rebuild dist with terminal feature"
```

- [ ] **Step 6: Final push**

```bash
git push
```
