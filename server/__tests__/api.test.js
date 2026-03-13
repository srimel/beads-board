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

  it('does not use deprecated url.parse()', async () => {
    // Verify the handlers module does not import or use url.parse
    const fs = await import('node:fs');
    const handlersPath = path.join(__dirname, '..', 'handlers.js');
    const source = fs.readFileSync(handlersPath, 'utf8');
    expect(source).not.toMatch(/url\.parse\s*\(/);
  });
});
