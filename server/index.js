const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { attachTerminal, cleanupAllPtys } = require('./terminal.js');
const { createRequestHandler } = require('./handlers.js');

const DEFAULT_PORT = 8377;
const DIST_DIR = path.join(__dirname, 'dist');

// Project directory: passed as CLI arg or cwd
const PROJECT_DIR = process.argv[2] || process.cwd();

// ---------------------------------------------------------------------------
// Pidfile management
// ---------------------------------------------------------------------------

const PIDFILE = path.join(PROJECT_DIR, '.beads-board.pid');

function writePidfile(port) {
  fs.writeFileSync(PIDFILE, JSON.stringify({ pid: process.pid, port }));
}

function removePidfile() {
  try { fs.unlinkSync(PIDFILE); } catch {}
}

function getRunningInstance() {
  try {
    const data = JSON.parse(fs.readFileSync(PIDFILE, 'utf8'));
    // Check if process is still running
    process.kill(data.pid, 0);
    return data;
  } catch {
    removePidfile();
    return null;
  }
}

// ---------------------------------------------------------------------------
// Port detection
// ---------------------------------------------------------------------------

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const s = http.createServer();
    s.listen(startPort, () => {
      s.close(() => resolve(startPort));
    });
    s.on('error', () => {
      if (startPort < DEFAULT_PORT + 10) {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(new Error('No available port found'));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

const handleRequest = createRequestHandler(PROJECT_DIR, DIST_DIR);
const server = http.createServer(handleRequest);

const terminalEnabled = attachTerminal(server, PROJECT_DIR);
if (terminalEnabled) {
  console.log('Terminal feature enabled');
}

async function start() {
  const existing = getRunningInstance();
  if (existing) {
    console.log(`beads-board already running at http://localhost:${existing.port}`);
    process.exit(0);
  }

  const port = await findAvailablePort(parseInt(process.env.PORT || DEFAULT_PORT, 10));
  server.listen(port, () => {
    writePidfile(port);
    console.log(`beads-board server running at http://localhost:${port}`);
  });
}

process.on('SIGTERM', () => { cleanupAllPtys(); removePidfile(); process.exit(0); });
process.on('SIGINT', () => { cleanupAllPtys(); removePidfile(); process.exit(0); });

start();
