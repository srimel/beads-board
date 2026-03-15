let pty, WebSocket;
try {
  pty = require('node-pty');
  WebSocket = require('ws');
} catch {
  // Dependencies not available — terminal feature disabled
}

const activePtys = new Set();

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
    const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (pathname !== '/ws/terminal') {
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
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', code: 1 }));
        ws.close(1011, 'Terminal spawn failed');
      }
      return;
    }

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

module.exports = { attachTerminal, cleanupAllPtys, setPty };
