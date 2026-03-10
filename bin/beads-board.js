#!/usr/bin/env node

const path = require('node:path');
const fs = require('node:fs');

const args = process.argv.slice(2);

// --help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`bdui — Kanban dashboard and git log viewer for Beads

Usage:
  bdui [project-dir] [options]

Options:
  --port <port>   Port to listen on (default: 8377)
  --help, -h      Show this help message
  --version, -v   Show version number

Examples:
  bdui                     # Use current directory
  bdui /path/to/project    # Specify project directory
  bdui --port 9000         # Custom port`);
  process.exit(0);
}

// --version
if (args.includes('--version') || args.includes('-v')) {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  console.log(pkg.version);
  process.exit(0);
}

// Parse --port
let customPort = null;
const portIdx = args.indexOf('--port');
if (portIdx !== -1) {
  customPort = args[portIdx + 1];
  if (!customPort || isNaN(parseInt(customPort, 10))) {
    console.error('Error: --port requires a numeric value');
    process.exit(1);
  }
  args.splice(portIdx, 2);
}

// Remaining arg is the project directory
const projectDir = args[0] ? path.resolve(args[0]) : process.cwd();

// Validate project directory exists
if (!fs.existsSync(projectDir)) {
  console.error(`Error: directory not found: ${projectDir}`);
  process.exit(1);
}

// Check for .beads/ directory
if (!fs.existsSync(path.join(projectDir, '.beads'))) {
  console.error(`Error: no .beads/ directory found in ${projectDir}`);
  console.error('This project does not appear to use Beads issue tracking.');
  console.error('See https://github.com/steveyegge/beads to get started.');
  process.exit(1);
}

// Set PORT env var if custom port specified, then delegate to server
if (customPort) {
  process.env.PORT = customPort;
}

// Rewrite process.argv so server/index.js sees the project dir
process.argv = [process.argv[0], __filename, projectDir];

require(path.join(__dirname, '..', 'server', 'index.js'));
