const http = require('node:http');
const path = require('node:path');
const { attachTerminal, cleanupAllPtys } = require('./terminal.js');
const { createRequestHandler } = require('./handlers.js');
const { createPidfileManager } = require('./pidfile.js');

const DEFAULT_PORT = 8377;
const DIST_DIR = path.join(__dirname, 'dist');

// Project directory: passed as CLI arg or cwd
const PROJECT_DIR = process.argv[2] || process.cwd();

// ---------------------------------------------------------------------------
// Pidfile management
// ---------------------------------------------------------------------------

const pidfile = createPidfileManager(PROJECT_DIR);

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
  const existing = pidfile.getRunningInstance();
  if (existing) {
    console.log(`beads-board already running at http://localhost:${existing.port}`);
    process.exit(0);
  }

  const port = await findAvailablePort(parseInt(process.env.PORT || DEFAULT_PORT, 10));
  server.listen(port, () => {
    pidfile.writePidfile(port);
    console.log(`beads-board server running at http://localhost:${port}`);
  });
}

pidfile.registerCleanupHandlers(cleanupAllPtys);

start();
