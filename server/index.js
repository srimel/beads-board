const http = require('node:http');
const { execFile } = require('node:child_process');
const path = require('node:path');
const url = require('node:url');

const DEFAULT_PORT = 8377;

// Project directory: passed as CLI arg or cwd
const PROJECT_DIR = process.argv[2] || process.cwd();

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function execCmd(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout: 10000 }, (err, stdout, stderr) => {
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

  try {
    if (pathname === '/api/issues') {
      const issues = await execBd(['list']);
      jsonResponse(res, issues);
    } else if (pathname === '/api/ready') {
      const ready = await execBd(['ready']);
      jsonResponse(res, ready);
    } else if (pathname === '/api/blocked') {
      const blocked = await execBd(['blocked']);
      jsonResponse(res, blocked);
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
      const limit = parseInt(parsed.query.limit || '50', 10);
      if (branch && !/^[\w\/.@{}-]+$/.test(branch)) {
        errorResponse(res, 'Invalid branch name', 400);
        return;
      }
      const format = '{"hash":"%h","message":"%s","author":"%an","date":"%ai"}';
      const args = ['log', `--format=${format}`, `-n`, `${limit}`];
      if (branch) args.splice(1, 0, branch);
      const stdout = await execGit(args);
      const commits = stdout.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
      jsonResponse(res, commits);
    } else if (pathname === '/api/branches') {
      const stdout = await execGit(['branch', '--format=%(refname:short)']);
      const branches = stdout.trim().split('\n').filter(Boolean);
      const current = (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
      jsonResponse(res, { branches, current });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  } catch (err) {
    errorResponse(res, err.message);
  }
}

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

const server = http.createServer(handleRequest);

const port = parseInt(process.env.PORT || DEFAULT_PORT, 10);
server.listen(port, () => {
  console.log(`beads-board server running at http://localhost:${port}`);
});
