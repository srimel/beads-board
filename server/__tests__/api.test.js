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

  it('excludes hidden files and common ignored directories', async () => {
    const res = await get('/api/files');
    expect(res.status).toBe(200);
    const names = res.data.map(e => e.name);
    expect(names).not.toContain('.git');
    expect(names).not.toContain('node_modules');
  });
});
