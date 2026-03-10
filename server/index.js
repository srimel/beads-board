const http = require('node:http');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const path = require('node:path');
const url = require('node:url');

const DEFAULT_PORT = 8377;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Project directory: passed as CLI arg or cwd
const PROJECT_DIR = process.argv[2] || process.cwd();

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function execCmd(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout: 10000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr || err.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function execBd(args) {
  const stdout = await execCmd('bd', [...args, '--json'], PROJECT_DIR);
  try {
    return JSON.parse(stdout);
  } catch {
    // bd list with no issues prints "No issues found." instead of JSON
    return [];
  }
}

async function execGit(args) {
  return execCmd('git', args, PROJECT_DIR);
}

// ---------------------------------------------------------------------------
// Issue normalization — bd CLI outputs `issue_type`, UI expects `type`
// ---------------------------------------------------------------------------

function normalizeIssue(issue) {
  if (issue.issue_type && !issue.type) {
    issue.type = issue.issue_type;
  }
  return issue;
}

// ---------------------------------------------------------------------------
// JSON response helpers
// ---------------------------------------------------------------------------

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function errorResponse(res, message, status = 500) {
  jsonResponse(res, { error: message }, status);
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

  try {
    if (pathname === '/api/issues') {
      const issues = await execBd(['list', '--flat', '--status=all']);
      jsonResponse(res, Array.isArray(issues) ? issues.map(normalizeIssue) : issues);
    } else if (pathname === '/api/ready') {
      const ready = await execBd(['ready']);
      jsonResponse(res, Array.isArray(ready) ? ready.map(normalizeIssue) : ready);
    } else if (pathname === '/api/blocked') {
      const blocked = await execBd(['blocked']);
      jsonResponse(res, Array.isArray(blocked) ? blocked.map(normalizeIssue) : blocked);
    } else if (pathname.startsWith('/api/issue/')) {
      const id = pathname.split('/api/issue/')[1];
      if (!id || !/^[\w-]+$/.test(id)) {
        errorResponse(res, 'Invalid issue ID', 400);
        return;
      }
      const issue = await execBd(['show', id]);
      jsonResponse(res, issue);
    } else if (pathname === '/api/git-log') {
      const branch = parsed.query.branch || '';
      const limit = Math.min(Math.max(parseInt(parsed.query.limit || '50', 10) || 50, 1), 500);
      if (branch && !/^[\w\/.@{}-]+$/.test(branch)) {
        errorResponse(res, 'Invalid branch name', 400);
        return;
      }
      const format = '%h%x00%s%x00%an%x00%ai';
      const args = ['log', `--format=${format}`, `-n`, `${limit}`];
      if (branch) args.splice(1, 0, branch);
      const stdout = await execGit(args);
      const commits = stdout.trim().split('\n').filter(Boolean).map(line => {
        const [hash, message, author, date] = line.split('\0');
        return { hash, message, author, date };
      });
      jsonResponse(res, commits);
    } else if (pathname === '/api/project') {
      let name = path.basename(PROJECT_DIR);
      try {
        const origin = (await execGit(['remote', 'get-url', 'origin'])).trim();
        const match = origin.match(/\/([^/]+?)(?:\.git)?$/);
        if (match) name = match[1];
      } catch {}
      jsonResponse(res, { name });
    } else if (pathname === '/api/branches') {
      const stdout = await execGit(['branch', '--format=%(refname:short)']);
      const branches = stdout.trim().split('\n').filter(Boolean);
      const current = (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
      jsonResponse(res, { branches, current });
    } else {
      // Serve static files from dist/
      let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(path.resolve(DIST_DIR))) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      // SPA fallback: serve index.html for non-file paths
      if (!path.extname(filePath)) {
        filePath = path.join(DIST_DIR, 'index.html');
      }
      try {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    }
  } catch (err) {
    errorResponse(res, err.message);
  }
}

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

const server = http.createServer(handleRequest);

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

process.on('SIGTERM', () => { removePidfile(); process.exit(0); });
process.on('SIGINT', () => { removePidfile(); process.exit(0); });

start();
