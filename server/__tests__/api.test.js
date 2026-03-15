import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequestHandler, setExecFile } from '../handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');
const PROJECT_DIR = path.join(__dirname, '..', '..');

let server;
let baseUrl;
const mockFn = vi.fn();

// Helper: mock execFile to return specific output for bd/git commands
function mockExecFile(fn) {
  mockFn.mockImplementation((cmd, args, opts, cb) => {
    const result = fn(cmd, args);
    if (result instanceof Error) {
      cb(result, '', result.message);
    } else {
      cb(null, result, '');
    }
  });
}

beforeAll(async () => {
  // Replace the real execFile with our mock
  setExecFile(mockFn);
  const handler = createRequestHandler(PROJECT_DIR, DIST_DIR);
  server = http.createServer(handler);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

afterEach(() => {
  mockFn.mockReset();
});

async function get(urlPath) {
  const r = await fetch(`${baseUrl}${urlPath}`);
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { status: r.status, data, text };
}

async function patch(urlPath, body) {
  const r = await fetch(`${baseUrl}${urlPath}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { status: r.status, data, text };
}

describe('API endpoints', () => {
  it('GET /api/issues returns JSON array', async () => {
    mockExecFile((cmd, args) => {
      return JSON.stringify([{ id: 'test-1', title: 'Test', issue_type: 'task' }]);
    });
    const res = await get('/api/issues');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data[0]).toHaveProperty('id', 'test-1');
    expect(res.data[0]).toHaveProperty('type', 'task'); // normalizeIssue applied
  });

  it('GET /api/issue/:id returns issue data for valid ID', async () => {
    mockExecFile((cmd, args) => {
      if (cmd === 'bd') return JSON.stringify({ id: 'beads-board-abc', title: 'Test Issue' });
      return '';
    });
    const res = await get('/api/issue/beads-board-abc');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('title', 'Test Issue');
  });

  it('GET /api/issue/:id accepts dotted IDs', async () => {
    mockExecFile((cmd, args) => {
      if (cmd === 'bd') return JSON.stringify({ id: 'beads-board-abc.1', title: 'Sub-task' });
      return '';
    });
    const res = await get('/api/issue/beads-board-abc.1');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id', 'beads-board-abc.1');
  });

  it('GET /api/issue/:id returns 400 for invalid ID', async () => {
    const res = await get('/api/issue/invalid;id');
    expect(res.status).toBe(400);
    expect(res.data).toHaveProperty('error', 'Invalid issue ID');
  });

  it('GET /api/ready returns JSON array', async () => {
    mockExecFile((cmd, args) => {
      if (cmd === 'bd') return JSON.stringify([{ id: 'test-2', title: 'Ready', issue_type: 'bug' }]);
      return '';
    });
    const res = await get('/api/ready');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('GET /api/blocked returns JSON array', async () => {
    mockExecFile((cmd, args) => {
      if (cmd === 'bd') return JSON.stringify([]);
      return '';
    });
    const res = await get('/api/blocked');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('GET / serves index.html', async () => {
    // No mock needed — this reads from dist/
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('GET /api/git-log parses branch and limit query params', async () => {
    mockExecFile((cmd, args) => {
      // Verify git log is called with the branch and limit from query params
      if (cmd === 'git') {
        expect(args).toContain('main');
        expect(args).toContain('-n');
        expect(args).toContain('10');
        return 'abc1234\x00feat: test\x00body\x00Author\x002025-01-01\x1e';
      }
      return '';
    });
    const res = await get('/api/git-log?branch=main&limit=10');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data[0]).toHaveProperty('hash', 'abc1234');
  });

  it('GET /api/git-log works without query params', async () => {
    mockExecFile((cmd, args) => {
      if (cmd === 'git') {
        expect(args).toContain('-n');
        expect(args).toContain('50'); // default limit
        return 'def5678\x00fix: something\x00\x00Dev\x002025-02-01\x1e';
      }
      return '';
    });
    const res = await get('/api/git-log');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('GET /api/git-diff parses file query param', async () => {
    mockExecFile((cmd, args) => {
      if (cmd === 'git' && args.includes('diff')) {
        expect(args).toContain('README.md');
        return '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new';
      }
      return '';
    });
    const res = await get('/api/git-diff?file=README.md');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('file', 'README.md');
    expect(res.data).toHaveProperty('diff');
  });

  it('does not use deprecated url.parse() in any server file', async () => {
    const fs = await import('node:fs');
    const serverFiles = ['handlers.js', 'terminal.js', 'index.js'];
    for (const file of serverFiles) {
      const filePath = path.join(__dirname, '..', file);
      const source = fs.readFileSync(filePath, 'utf8');
      expect(source).not.toMatch(/url\.parse\s*\(/);
    }
  });
});

describe('GET /api/files', () => {
  it('returns directory listing for project root', async () => {
    const res = await get('/api/files');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    // Project root should have package.json and server/ directory
    const names = res.data.map(e => e.name);
    expect(names).toContain('package.json');
    expect(names).toContain('server');
    // Each entry should have name, type, and path
    const serverEntry = res.data.find(e => e.name === 'server');
    expect(serverEntry).toHaveProperty('type', 'directory');
    expect(serverEntry).toHaveProperty('path', 'server');
  });

  it('returns directory listing for a subdirectory', async () => {
    const res = await get('/api/files?path=server');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    const names = res.data.map(e => e.name);
    expect(names).toContain('index.js');
    expect(names).toContain('handlers.js');
  });

  it('returns 400 for path traversal attempts', async () => {
    const res = await get('/api/files?path=../../../etc');
    expect(res.status).toBe(400);
    expect(res.data).toHaveProperty('error');
  });

  it('returns 404 for non-existent directory', async () => {
    const res = await get('/api/files?path=nonexistent-dir-xyz');
    expect(res.status).toBe(404);
    expect(res.data).toHaveProperty('error');
  });

  it('sorts directories before files', async () => {
    const res = await get('/api/files');
    expect(res.status).toBe(200);
    const dirs = res.data.filter(e => e.type === 'directory');
    const files = res.data.filter(e => e.type === 'file');
    // All directories should come before files in the array
    if (dirs.length > 0 && files.length > 0) {
      const lastDirIdx = res.data.lastIndexOf(dirs[dirs.length - 1]);
      const firstFileIdx = res.data.indexOf(files[0]);
      expect(lastDirIdx).toBeLessThan(firstFileIdx);
    }
  });

  it('returns file content for a valid file path', async () => {
    const res = await get('/api/file-content?path=package.json');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('path', 'package.json');
    expect(res.data).toHaveProperty('content');
    expect(res.data).toHaveProperty('language');
    expect(typeof res.data.content).toBe('string');
    expect(res.data.content).toContain('beads');
  });

  it('returns 400 for path traversal in file-content', async () => {
    const res = await get('/api/file-content?path=../../etc/passwd');
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent file', async () => {
    const res = await get('/api/file-content?path=does-not-exist.txt');
    expect(res.status).toBe(404);
  });

  it('returns correct language for known extensions', async () => {
    const res = await get('/api/file-content?path=server/handlers.js');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('language', 'javascript');
  });

  it('excludes only .git but shows dotfiles, node_modules, and coverage', async () => {
    const res = await get('/api/files');
    expect(res.status).toBe(200);
    const names = res.data.map(e => e.name);
    expect(names).not.toContain('.git');
    // Dotfiles, node_modules, coverage should all be visible
    expect(names).toContain('.gitignore');
    expect(names).toContain('node_modules');
  });
});

describe('Branch-aware endpoints', () => {
  describe('GET /api/git-status', () => {
    it('without branch param calls git status --porcelain', async () => {
      mockExecFile((cmd, args) => {
        if (cmd === 'git') {
          expect(args[0]).toBe('status');
          expect(args).toContain('--porcelain');
          return 'M  README.md\n';
        }
        return '';
      });
      const res = await get('/api/git-status');
      expect(res.status).toBe(200);
      expect(res.data[0]).toHaveProperty('path', 'README.md');
    });

    it('with branch param calls git diff --name-status <branch>', async () => {
      mockExecFile((cmd, args) => {
        if (cmd === 'git') {
          expect(args[0]).toBe('diff');
          expect(args).toContain('--name-status');
          expect(args).toContain('feature-branch');
          return 'M\tREADME.md\nA\tnew-file.js\n';
        }
        return '';
      });
      const res = await get('/api/git-status?branch=feature-branch');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data[0]).toHaveProperty('status', 'M');
      expect(res.data[0]).toHaveProperty('path', 'README.md');
      expect(res.data[1]).toHaveProperty('status', 'A');
      expect(res.data[1]).toHaveProperty('path', 'new-file.js');
    });

    it('with branch param rejects invalid branch names', async () => {
      const res = await get('/api/git-status?branch=bad;branch');
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty('error', 'Invalid branch name');
    });
  });

  describe('GET /api/git-diff', () => {
    it('without branch param calls git diff HEAD -- <file>', async () => {
      mockExecFile((cmd, args) => {
        if (cmd === 'git' && args.includes('diff')) {
          expect(args).toContain('HEAD');
          expect(args).toContain('README.md');
          return '--- a/README.md\n+++ b/README.md\n@@ -1 +1 @@\n-old\n+new';
        }
        return '';
      });
      const res = await get('/api/git-diff?file=README.md');
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('file', 'README.md');
    });

    it('with branch param calls git diff <branch> -- <file>', async () => {
      mockExecFile((cmd, args) => {
        if (cmd === 'git' && args.includes('diff')) {
          expect(args).toContain('feature-branch');
          expect(args).toContain('--');
          expect(args).toContain('server.js');
          return '--- a/server.js\n+++ b/server.js\n@@ -1 +1 @@\n-old\n+new';
        }
        return '';
      });
      const res = await get('/api/git-diff?file=server.js&branch=feature-branch');
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('file', 'server.js');
      expect(res.data).toHaveProperty('diff');
    });

    it('with branch param rejects invalid branch names', async () => {
      const res = await get('/api/git-diff?file=README.md&branch=bad;branch');
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty('error', 'Invalid branch name');
    });
  });

  describe('GET /api/files with branch param', () => {
    it('with branch param calls git ls-tree (single call)', async () => {
      let lsTreeCalls = 0;
      mockExecFile((cmd, args) => {
        if (cmd === 'git') {
          expect(args[0]).toBe('ls-tree');
          expect(args).not.toContain('--name-only');
          expect(args).toContain('feature-branch');
          lsTreeCalls++;
          return '100644 blob abcdef1234567890\tREADME.md\n100644 blob abcdef1234567891\tpackage.json\n040000 tree abcdef1234567892\tsrc\n';
        }
        return '';
      });
      const res = await get('/api/files?branch=feature-branch');
      expect(res.status).toBe(200);
      expect(lsTreeCalls).toBe(1);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBe(3);
      const srcEntry = res.data.find(e => e.name === 'src');
      expect(srcEntry).toHaveProperty('type', 'directory');
      const readmeEntry = res.data.find(e => e.name === 'README.md');
      expect(readmeEntry).toHaveProperty('type', 'file');
    });

    it('with branch param filters ignored directories', async () => {
      mockExecFile((cmd, args) => {
        if (cmd === 'git') {
          return '040000 tree aaa\tnode_modules\n040000 tree bbb\t.git\n040000 tree ccc\tsrc\n100644 blob ddd\tREADME.md\n100644 blob eee\t.env\n';
        }
        return '';
      });
      const res = await get('/api/files?branch=feature-branch');
      expect(res.status).toBe(200);
      const names = res.data.map(e => e.name);
      expect(names).toContain('src');
      expect(names).toContain('README.md');
      expect(names).toContain('node_modules');
      expect(names).not.toContain('.git');
      expect(names).toContain('.env');
    });

    it('with branch param and path lists subdirectory via git ls-tree', async () => {
      mockExecFile((cmd, args) => {
        if (cmd === 'git') {
          expect(args[0]).toBe('ls-tree');
          expect(args).toContain('feature-branch:server');
          return '100644 blob abcdef1234567890\tindex.js\n100644 blob abcdef1234567891\thandlers.js\n';
        }
        return '';
      });
      const res = await get('/api/files?path=server&branch=feature-branch');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBe(2);
    });

    it('with branch param rejects invalid branch names', async () => {
      const res = await get('/api/files?branch=bad;branch');
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty('error', 'Invalid branch name');
    });

    it('with branch param shows everything except .git', async () => {
      mockExecFile((cmd, args) => {
        if (cmd === 'git') {
          return '040000 tree aaa\tnode_modules\n040000 tree bbb\t.git\n040000 tree ccc\tsrc\n100644 blob ddd\tREADME.md\n100644 blob eee\t.env\n100644 blob fff\t.eslintrc\n040000 tree abc\tcoverage\n';
        }
        return '';
      });
      const res = await get('/api/files?branch=feature-branch');
      expect(res.status).toBe(200);
      const names = res.data.map(e => e.name);
      expect(names).toContain('src');
      expect(names).toContain('README.md');
      expect(names).toContain('.env');
      expect(names).toContain('.eslintrc');
      expect(names).toContain('node_modules');
      expect(names).toContain('coverage');
      expect(names).not.toContain('.git');
    });
  });

  describe('PATCH /api/issue/:id', () => {
    it('updates description via bd update', async () => {
      mockExecFile((cmd, args) => {
        if (cmd === 'bd') {
          expect(args[0]).toBe('update');
          expect(args[1]).toBe('beads-board-abc');
          expect(args).toContain('--description');
          expect(args).toContain('New description text');
          return '';
        }
        return '';
      });
      const res = await patch('/api/issue/beads-board-abc', { description: 'New description text' });
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('ok', true);
    });

    it('returns 400 for invalid issue ID', async () => {
      const res = await patch('/api/issue/invalid;id', { description: 'test' });
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty('error', 'Invalid issue ID');
    });

    it('returns 400 when description field is missing', async () => {
      const res = await patch('/api/issue/beads-board-abc', {});
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty('error');
    });

    it('returns 500 when bd update fails', async () => {
      mockExecFile((cmd, args) => {
        if (cmd === 'bd') throw new Error('bd update failed: issue not found');
        return '';
      });
      const res = await patch('/api/issue/beads-board-abc', { description: 'test' });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/file-content', () => {
    it('with branch param calls git show <branch>:<path>', async () => {
      mockExecFile((cmd, args) => {
        if (cmd === 'git') {
          expect(args[0]).toBe('show');
          expect(args[1]).toBe('feature-branch:src/index.ts');
          return 'console.log("hello")';
        }
        return '';
      });
      const res = await get('/api/file-content?path=src/index.ts&branch=feature-branch');
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('content', 'console.log("hello")');
      expect(res.data).toHaveProperty('language', 'typescript');
    });

    it('with branch param rejects invalid branch names', async () => {
      const res = await get('/api/file-content?path=README.md&branch=bad;branch');
      expect(res.status).toBe(400);
      expect(res.data).toHaveProperty('error', 'Invalid branch name');
    });
  });
});
