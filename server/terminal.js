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
