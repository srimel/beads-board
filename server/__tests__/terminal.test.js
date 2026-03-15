import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

import { attachTerminal, cleanupAllPtys, setPty } from '../terminal.js';

const mockSpawn = vi.fn();

describe('terminal spawn error handling', () => {
  let server;
  let addr;
  let openSockets = [];

  beforeEach(async () => {
    mockSpawn.mockReset();
    setPty({ spawn: mockSpawn });

    server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    attachTerminal(server, '/tmp');
    await new Promise((resolve) => server.listen(0, resolve));
    addr = server.address();
  });

  afterEach(async () => {
    for (const ws of openSockets) {
      try { ws.close(); } catch {}
    }
    openSockets = [];
    cleanupAllPtys();
    await new Promise((resolve) => server.close(resolve));
  });

  function connectWs() {
    const ws = new WebSocket(`ws://localhost:${addr.port}/ws/terminal`);
    openSockets.push(ws);
    return ws;
  }

  it('server stays up when pty.spawn() throws', async () => {
    mockSpawn.mockImplementation(() => {
      throw new Error('posix_spawnp failed.');
    });

    const ws = connectWs();
    await new Promise((resolve) => {
      ws.on('close', resolve);
      ws.on('error', resolve);
    });

    // Server should still be responsive after the failed spawn
    const res = await fetch(`http://localhost:${addr.port}/`);
    expect(res.status).toBe(200);
  });

  it('closes WebSocket with exit message when pty.spawn() throws', async () => {
    mockSpawn.mockImplementation(() => {
      throw new Error('posix_spawnp failed.');
    });

    const ws = connectWs();
    const messages = [];
    await new Promise((resolve) => {
      ws.on('message', (data) => messages.push(data.toString()));
      ws.on('close', resolve);
      ws.on('error', resolve);
    });

    const exitMsg = messages.find((m) => {
      try { return JSON.parse(m).type === 'exit'; } catch { return false; }
    });
    expect(exitMsg).toBeDefined();
    expect(JSON.parse(exitMsg)).toEqual({ type: 'exit', code: 1 });
  });

  it('works normally when pty.spawn() succeeds', async () => {
    const mockPtyProcess = new EventEmitter();
    mockPtyProcess.onData = (cb) => mockPtyProcess.on('data', cb);
    mockPtyProcess.onExit = (cb) => mockPtyProcess.on('exit', cb);
    mockPtyProcess.write = vi.fn();
    mockPtyProcess.resize = vi.fn();
    mockPtyProcess.kill = vi.fn();
    mockSpawn.mockReturnValue(mockPtyProcess);

    const ws = connectWs();
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    expect(mockSpawn).toHaveBeenCalledOnce();
    expect(ws.readyState).toBe(WebSocket.OPEN);

    // Server still responsive
    const res = await fetch(`http://localhost:${addr.port}/`);
    expect(res.status).toBe(200);

    ws.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});
