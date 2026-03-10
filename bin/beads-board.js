#!/usr/bin/env node

const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const SERVER_SCRIPT = path.join(__dirname, '..', 'server', 'index.js');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const rawArgs = process.argv.slice(2);

// Extract subcommand (start, stop, status) — default to "start"
const SUBCOMMANDS = ['start', 'stop', 'status'];
let subcommand = 'start';
const args = [];
for (const arg of rawArgs) {
  if (SUBCOMMANDS.includes(arg) && args.length === 0 && subcommand === 'start') {
    subcommand = arg;
  } else {
    args.push(arg);
  }
}

// --help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`bdui — Kanban dashboard and git log viewer for Beads

Usage:
  bdui [project-dir] [options]        Start the dashboard (default)
  bdui start [project-dir] [options]  Start the dashboard
  bdui stop [project-dir]             Stop a running dashboard
  bdui status [project-dir]           Show running dashboard info

Options:
  --port <port>     Port to listen on (default: 8377)
  --foreground      Run in foreground (don't daemonize)
  --help, -h        Show this help message
  --version, -v     Show version number

Examples:
  bdui                     # Start dashboard for current directory
  bdui /path/to/project    # Specify project directory
  bdui --port 9000         # Custom port
  bdui stop                # Stop the running dashboard
  bdui status              # Check if dashboard is running`);
  process.exit(0);
}

// --version
if (args.includes('--version') || args.includes('-v')) {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  console.log(pkg.version);
  process.exit(0);
}

// --foreground
const foreground = args.includes('--foreground');
const filteredArgs = args.filter(a => a !== '--foreground');

// --port
let customPort = null;
const portIdx = filteredArgs.indexOf('--port');
if (portIdx !== -1) {
  customPort = filteredArgs[portIdx + 1];
  if (!customPort || isNaN(parseInt(customPort, 10))) {
    console.error('Error: --port requires a numeric value');
    process.exit(1);
  }
  filteredArgs.splice(portIdx, 2);
}

// Remaining arg is the project directory
const projectDir = filteredArgs[0] ? path.resolve(filteredArgs[0]) : process.cwd();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

if (!fs.existsSync(projectDir)) {
  console.error(`Error: directory not found: ${projectDir}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(projectDir, '.beads'))) {
  console.error(`Error: no .beads/ directory found in ${projectDir}`);
  console.error('This project does not appear to use Beads issue tracking.');
  console.error('See https://github.com/steveyegge/beads to get started.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Pidfile helpers
// ---------------------------------------------------------------------------

const PIDFILE = path.join(projectDir, '.beads-board.pid');

function getRunningInstance() {
  try {
    const data = JSON.parse(fs.readFileSync(PIDFILE, 'utf8'));
    process.kill(data.pid, 0); // throws if not running
    return data;
  } catch {
    // Clean up stale pidfile
    try { fs.unlinkSync(PIDFILE); } catch {}
    return null;
  }
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

if (subcommand === 'status') {
  const instance = getRunningInstance();
  if (instance) {
    console.log(`beads-board running at http://localhost:${instance.port} (pid ${instance.pid})`);
  } else {
    console.log('beads-board is not running');
    process.exit(1);
  }
  process.exit(0);
}

if (subcommand === 'stop') {
  const instance = getRunningInstance();
  if (!instance) {
    console.log('beads-board is not running');
    process.exit(0);
  }
  try {
    process.kill(instance.pid, 'SIGTERM');
    console.log(`beads-board stopped (was http://localhost:${instance.port}, pid ${instance.pid})`);
  } catch (err) {
    console.error(`Failed to stop beads-board (pid ${instance.pid}): ${err.message}`);
    process.exit(1);
  }
  process.exit(0);
}

// subcommand === 'start'
const existing = getRunningInstance();
if (existing) {
  console.log(`beads-board already running at http://localhost:${existing.port} (pid ${existing.pid})`);
  process.exit(0);
}

if (foreground) {
  // Run server in foreground (debugging)
  if (customPort) process.env.PORT = customPort;
  process.argv = [process.argv[0], __filename, projectDir];
  require(SERVER_SCRIPT);
} else {
  // Spawn detached server process
  const env = { ...process.env };
  if (customPort) env.PORT = customPort;

  const child = spawn(process.execPath, [SERVER_SCRIPT, projectDir], {
    detached: true,
    stdio: 'ignore',
    env,
    windowsHide: true,
  });
  child.unref();

  // Wait for pidfile to confirm startup (poll up to 3s)
  const start = Date.now();
  const poll = setInterval(() => {
    const instance = getRunningInstance();
    if (instance) {
      clearInterval(poll);
      console.log(`beads-board running at http://localhost:${instance.port}`);
      process.exit(0);
    }
    if (Date.now() - start > 3000) {
      clearInterval(poll);
      console.error('Error: server failed to start within 3 seconds');
      process.exit(1);
    }
  }, 100);
}
