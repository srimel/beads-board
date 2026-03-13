const fs = require('node:fs');
const { execFile } = require('node:child_process');
const path = require('node:path');
const url = require('node:url');

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

// Indirection for testability — tests can replace _execFileFn to mock CLI calls
let _execFileFn = execFile;

function setExecFile(fn) {
  _execFileFn = fn;
}

function execCmd(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    _execFileFn(cmd, args, { cwd, timeout: 10000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr || err.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function execBd(args, projectDir) {
  const stdout = await execCmd('bd', [...args, '--json'], projectDir);
  try {
    return JSON.parse(stdout);
  } catch {
    // bd list with no issues prints "No issues found." instead of JSON
    return [];
  }
}

async function execGit(args, projectDir) {
  return execCmd('git', args, projectDir);
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
// Request handler factory
// ---------------------------------------------------------------------------

function createRequestHandler(projectDir, distDir) {
  return async function handleRequest(req, res) {
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
        const issues = await execBd(['list', '--flat', '--status=all', '--limit=0'], projectDir);
        jsonResponse(res, Array.isArray(issues) ? issues.map(normalizeIssue) : issues);
      } else if (pathname === '/api/ready') {
        const ready = await execBd(['ready'], projectDir);
        jsonResponse(res, Array.isArray(ready) ? ready.map(normalizeIssue) : ready);
      } else if (pathname === '/api/blocked') {
        const blocked = await execBd(['blocked'], projectDir);
        jsonResponse(res, Array.isArray(blocked) ? blocked.map(normalizeIssue) : blocked);
      } else if (pathname.startsWith('/api/issue/')) {
        const id = pathname.split('/api/issue/')[1];
        if (!id || !/^[\w.\-]+$/.test(id)) {
          errorResponse(res, 'Invalid issue ID', 400);
          return;
        }
        const issue = await execBd(['show', id], projectDir);
        jsonResponse(res, issue);
      } else if (pathname === '/api/git-log') {
        const branch = parsed.query.branch || '';
        const limit = Math.min(Math.max(parseInt(parsed.query.limit || '50', 10) || 50, 1), 500);
        if (branch && !/^[\w\/.@{}-]+$/.test(branch)) {
          errorResponse(res, 'Invalid branch name', 400);
          return;
        }
        const format = '%h%x00%s%x00%b%x00%an%x00%ai%x1e';
        const args = ['log', `--format=${format}`, `-n`, `${limit}`];
        if (branch) args.splice(1, 0, branch);
        const stdout = await execGit(args, projectDir);
        const commits = stdout.split('\x1e').filter(s => s.trim()).map(record => {
          const [hash, message, body, author, date] = record.trim().split('\0');
          return { hash, message, body: body?.trim() || '', author, date };
        });
        jsonResponse(res, commits);
      } else if (pathname === '/api/project') {
        let name = path.basename(projectDir);
        try {
          const origin = (await execGit(['remote', 'get-url', 'origin'], projectDir)).trim();
          const match = origin.match(/\/([^/]+?)(?:\.git)?$/);
          if (match) name = match[1];
        } catch {}
        jsonResponse(res, { name });
      } else if (pathname === '/api/dependencies') {
        const issues = await execBd(['list', '--flat', '--status=all', '--limit=0'], projectDir);
        const allIssues = Array.isArray(issues) ? issues.map(normalizeIssue) : [];
        const edges = [];
        for (const issue of allIssues) {
          if (issue.dependencies && Array.isArray(issue.dependencies)) {
            for (const dep of issue.dependencies) {
              const depId = typeof dep === 'string' ? dep : dep.id || dep.issue_id;
              if (depId) {
                edges.push({ from: issue.id, to: depId });
              }
            }
          }
        }
        jsonResponse(res, { nodes: allIssues, edges });
      } else if (pathname === '/api/projects') {
        try {
          const parentDir = path.dirname(projectDir);
          const entries = fs.readdirSync(parentDir, { withFileTypes: true });
          const projects = [];
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const fullPath = path.join(parentDir, entry.name);
              const beadsDir = path.join(fullPath, '.beads');
              try {
                const stat = fs.statSync(beadsDir);
                if (stat.isDirectory()) {
                  projects.push({ name: entry.name, path: fullPath });
                }
              } catch {
                // No .beads directory, skip
              }
            }
          }
          projects.sort((a, b) => a.name.localeCompare(b.name));
          jsonResponse(res, projects);
        } catch {
          jsonResponse(res, []);
        }
      } else if (pathname === '/api/git-status') {
        const stdout = await execGit(['status', '--porcelain'], projectDir);
        const files = stdout.replace(/\n$/, '').split('\n').filter(Boolean).map(line => {
          const match = line.match(/^(..)[ ](.+)$/);
          if (!match) return { status: '?', path: line.trim() };
          return { status: match[1].trim(), path: match[2] };
        });
        jsonResponse(res, files);
      } else if (pathname === '/api/git-diff') {
        const file = parsed.query.file || '';
        if (!file || /[;&|`$]/.test(file)) {
          errorResponse(res, 'Invalid file path', 400);
          return;
        }
        try {
          // Try staged + unstaged diff first, fall back to untracked file content
          let diff;
          try {
            diff = await execGit(['diff', 'HEAD', '--', file], projectDir);
            if (!diff.trim()) {
              diff = await execGit(['diff', '--', file], projectDir);
            }
          } catch {
            diff = '';
          }
          if (!diff.trim()) {
            // Untracked file — show full content as addition
            try {
              const content = fs.readFileSync(
                path.join(projectDir, file), 'utf8'
              );
              const lines = content.split('\n').map(l => '+' + l).join('\n');
              diff = `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${content.split('\n').length} @@\n${lines}`;
            } catch {
              diff = '';
            }
          }
          jsonResponse(res, { file, diff });
        } catch (err) {
          errorResponse(res, err.message);
        }
      } else if (pathname === '/api/file-content') {
        const relPath = parsed.query.path || '';
        if (!relPath || relPath.includes('..') || path.isAbsolute(relPath)) {
          errorResponse(res, 'Invalid path', 400);
          return;
        }
        const targetFile = path.join(projectDir, relPath);
        const resolved = path.resolve(targetFile);
        if (!resolved.startsWith(path.resolve(projectDir))) {
          errorResponse(res, 'Invalid path', 400);
          return;
        }
        const EXT_TO_LANG = {
          '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
          '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'jsx',
          '.json': 'json', '.jsonc': 'jsonc', '.jsonl': 'jsonl',
          '.md': 'markdown', '.mdx': 'mdx',
          '.html': 'html', '.htm': 'html',
          '.css': 'css', '.scss': 'scss', '.sass': 'sass',
          '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
          '.java': 'java', '.kt': 'kotlin', '.kts': 'kotlin',
          '.c': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.h': 'c', '.hpp': 'cpp',
          '.cs': 'csharp',
          '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
          '.ps1': 'powershell', '.psm1': 'powershell',
          '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml', '.ini': 'ini',
          '.xml': 'xml', '.svg': 'xml', '.sql': 'sql',
          '.dockerfile': 'dockerfile',
          '.graphql': 'graphql', '.gql': 'graphql',
          '.tex': 'latex', '.latex': 'latex',
          '.swift': 'swift', '.zig': 'zig', '.php': 'php',
          '.vue': 'vue', '.svelte': 'svelte',
          '.env': 'dotenv',
          '.mermaid': 'mermaid', '.mmd': 'mermaid',
          '.kusto': 'kusto', '.kql': 'kusto',
        };
        try {
          const content = fs.readFileSync(resolved, 'utf8');
          const ext = path.extname(relPath).toLowerCase();
          const language = EXT_TO_LANG[ext] || 'text';
          jsonResponse(res, { path: relPath, content, language });
        } catch (err) {
          if (err.code === 'ENOENT' || err.code === 'EISDIR') {
            errorResponse(res, 'File not found', 404);
          } else {
            errorResponse(res, err.message);
          }
        }
      } else if (pathname === '/api/files') {
        const relPath = parsed.query.path || '';
        // Block path traversal
        if (relPath.includes('..') || path.isAbsolute(relPath)) {
          errorResponse(res, 'Invalid path', 400);
          return;
        }
        const targetDir = path.join(projectDir, relPath);
        const resolved = path.resolve(targetDir);
        if (!resolved.startsWith(path.resolve(projectDir))) {
          errorResponse(res, 'Invalid path', 400);
          return;
        }
        const IGNORED = new Set(['.git', 'node_modules', '.beads', '.claude', '.playwright-mcp', 'coverage', '.vscode']);
        try {
          const entries = fs.readdirSync(targetDir, { withFileTypes: true });
          const results = [];
          for (const entry of entries) {
            // Skip hidden files/dirs and common ignored directories
            if (entry.name.startsWith('.') || IGNORED.has(entry.name)) continue;
            const entryPath = relPath ? `${relPath}/${entry.name}` : entry.name;
            results.push({
              name: entry.name,
              type: entry.isDirectory() ? 'directory' : 'file',
              path: entryPath,
            });
          }
          // Sort: directories first, then alphabetically within each group
          results.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          });
          jsonResponse(res, results);
        } catch (err) {
          if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
            errorResponse(res, 'Directory not found', 404);
          } else {
            errorResponse(res, err.message);
          }
        }
      } else if (pathname === '/api/branches') {
        const stdout = await execGit(['branch', '--format=%(refname:short)'], projectDir);
        const branches = stdout.trim().split('\n').filter(Boolean);
        const current = (await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], projectDir)).trim();
        jsonResponse(res, { branches, current });
      } else {
        // Serve static files from dist/
        let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(path.resolve(distDir))) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }
        // SPA fallback: serve index.html for non-file paths
        if (!path.extname(filePath)) {
          filePath = path.join(distDir, 'index.html');
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
  };
}

module.exports = {
  MIME_TYPES,
  execCmd,
  execBd,
  execGit,
  normalizeIssue,
  jsonResponse,
  errorResponse,
  createRequestHandler,
  setExecFile,
};
