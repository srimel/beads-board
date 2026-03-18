let pty, WebSocket;
try {
  pty = require('node-pty');
  WebSocket = require('ws');
} catch {
  // Dependencies not available — terminal feature disabled
}

const {
  createSession,
  getSession,
  deleteSession,
  isValidSessionId,
  appendScrollback,
  clearAllSessions,
  DISCONNECT_TIMEOUT_MS,
} = require('./terminal-sessions.js');

/** Allow tests to inject a mock pty module */
function setPty(mockPty) {
  pty = mockPty;
}

function getShell() {
  if (process.platform === 'win32') return 'powershell.exe';
  return process.env.SHELL || 'bash';
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
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== '/ws/terminal') {
      socket.destroy();
      return;
    }

    // Origin validation — local connections only
    const origin = req.headers.origin || '';
    if (origin && !origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
      socket.destroy();
      return;
    }

    // Extract and validate session ID from query params
    const rawId = url.searchParams.get('session');
    req.terminalSessionId = (rawId && isValidSessionId(rawId)) ? rawId : null;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    const requestedSessionId = req.terminalSessionId;
    let session = requestedSessionId ? getSession(requestedSessionId) : null;

    if (session && session.pty) {
      // Reattach to existing session

      // Cancel disconnect timer
      if (session.disconnectTimer) {
        clearTimeout(session.disconnectTimer);
        session.disconnectTimer = null;
      }

      session.ws = ws;

      // Send session-restored, then replay scrollback
      ws.send(JSON.stringify({ type: 'session-restored' }));

      // Enter replay mode — queue new PTY output
      session.replaying = true;

      // Send scrollback chunks
      for (const chunk of session.scrollback) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunk);
        }
      }

      // Flush any output that arrived during replay
      for (const queued of session.outputQueue) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(queued);
        }
      }
      session.outputQueue = [];
      session.replaying = false;

      // Signal replay complete
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'session-replay-complete' }));
      }
    } else {
      // Create new session
      try {
        session = createSession({ cols: 80, rows: 24, evictIdle: true });
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
        ws.close();
        return;
      }

      session.ws = ws;

      const shell = getShell();
      let ptyProcess;
      try {
        ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: projectDir,
          env: process.env,
        });
      } catch (err) {
        console.error('Failed to spawn terminal:', err.message);
        deleteSession(session.id);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'exit', code: 1 }));
          ws.close(1011, 'Terminal spawn failed');
        }
        return;
      }

      session.pty = ptyProcess;

      ptyProcess.onData((data) => {
        appendScrollback(session, data);
        if (session.replaying) {
          session.outputQueue.push(data);
        } else if (session.ws && session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(data);
        }
      });

      ptyProcess.onExit(({ exitCode }) => {
        if (session.ws && session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
        }
        if (session.disconnectTimer) {
          clearTimeout(session.disconnectTimer);
        }
        deleteSession(session.id);
      });

      // Notify client of new session
      ws.send(JSON.stringify({ type: 'session-created', sessionId: session.id }));
    }

    ws.on('message', (msg) => {
      const str = msg.toString();
      try {
        const parsed = JSON.parse(str);
        if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
          session.cols = parsed.cols;
          session.rows = parsed.rows;
          if (session.pty) session.pty.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch {
        // Not JSON — raw terminal input
      }
      if (session.pty) session.pty.write(str);
    });

    ws.on('close', () => {
      // Guard: only act if this WS is still the current one for the session.
      // On reconnect, a new WS replaces session.ws before the old WS fires close.
      if (session.ws !== ws) return;

      session.ws = null;

      // Start disconnect timer — keep PTY alive for reconnect
      session.disconnectTimer = setTimeout(() => {
        if (session.pty) {
          try { session.pty.kill(); } catch {}
        }
        deleteSession(session.id);
      }, DISCONNECT_TIMEOUT_MS);
    });
  });

  return true;
}

function cleanupAllPtys() {
  clearAllSessions();
}

module.exports = { attachTerminal, cleanupAllPtys, setPty };
