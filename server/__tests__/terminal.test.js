import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

import { attachTerminal, cleanupAllPtys, setPty } from '../terminal.js';
import {
  createSession,
  getSession,
  deleteSession,
  isValidSessionId,
  getSessionCount,
  appendScrollback,
  clearAllSessions,
  MAX_SCROLLBACK_CHARS,
  MAX_SESSIONS,
  DISCONNECT_TIMEOUT_MS,
} from '../terminal-sessions.js';

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

describe('terminal-sessions', () => {
  afterEach(() => {
    clearAllSessions();
  });

  describe('createSession', () => {
    it('creates a session with a UUID-format id', () => {
      const session = createSession({ cols: 80, rows: 24 });
      expect(session.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('initializes session with correct defaults', () => {
      const session = createSession({ cols: 120, rows: 40 });
      expect(session.cols).toBe(120);
      expect(session.rows).toBe(40);
      expect(session.scrollback).toEqual([]);
      expect(session.scrollbackChars).toBe(0);
      expect(session.disconnectTimer).toBeNull();
      expect(session.ws).toBeNull();
      expect(session.replaying).toBe(false);
      expect(session.outputQueue).toEqual([]);
    });

    it('stores session in the sessions map', () => {
      const session = createSession({ cols: 80, rows: 24 });
      expect(getSession(session.id)).toBe(session);
    });

    it('enforces MAX_SESSIONS cap', () => {
      for (let i = 0; i < MAX_SESSIONS; i++) {
        createSession({ cols: 80, rows: 24 });
      }
      expect(getSessionCount()).toBe(MAX_SESSIONS);
      expect(() => createSession({ cols: 80, rows: 24 })).toThrow(/session limit/i);
    });

    it('evicts oldest idle session when at cap if one exists', () => {
      const sessions = [];
      for (let i = 0; i < MAX_SESSIONS; i++) {
        sessions.push(createSession({ cols: 80, rows: 24 }));
      }
      const firstId = sessions[0].id;
      const newSession = createSession({ cols: 80, rows: 24, evictIdle: true });
      expect(getSession(firstId)).toBeUndefined();
      expect(getSession(newSession.id)).toBe(newSession);
      expect(getSessionCount()).toBe(MAX_SESSIONS);
    });

    it('throws when evicting but all sessions are active', () => {
      for (let i = 0; i < MAX_SESSIONS; i++) {
        const s = createSession({ cols: 80, rows: 24 });
        s.ws = {}; // simulate active connection
      }
      expect(() => createSession({ cols: 80, rows: 24, evictIdle: true }))
        .toThrow(/all sessions are active/i);
    });
  });

  describe('isValidSessionId', () => {
    it('accepts valid UUIDs', () => {
      expect(isValidSessionId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
      expect(isValidSessionId('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('rejects invalid strings', () => {
      expect(isValidSessionId('')).toBe(false);
      expect(isValidSessionId('not-a-uuid')).toBe(false);
      expect(isValidSessionId('../../etc/passwd')).toBe(false);
      expect(isValidSessionId('a1b2c3d4-e5f6-7890-abcd')).toBe(false);
      expect(isValidSessionId('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(false);
    });
  });

  describe('getSession / deleteSession', () => {
    it('returns undefined for unknown session id', () => {
      expect(getSession('nonexistent')).toBeUndefined();
    });

    it('deletes a session', () => {
      const session = createSession({ cols: 80, rows: 24 });
      deleteSession(session.id);
      expect(getSession(session.id)).toBeUndefined();
      expect(getSessionCount()).toBe(0);
    });

    it('deleteSession is a no-op for unknown id', () => {
      createSession({ cols: 80, rows: 24 });
      deleteSession('nonexistent');
      expect(getSessionCount()).toBe(1);
    });
  });

  describe('scrollback buffer', () => {
    it('appends output to scrollback', () => {
      const session = createSession({ cols: 80, rows: 24 });
      appendScrollback(session, 'hello');
      appendScrollback(session, ' world');
      expect(session.scrollback).toEqual(['hello', ' world']);
      expect(session.scrollbackChars).toBe(11);
    });

    it('trims from front when exceeding MAX_SCROLLBACK_CHARS', () => {
      const session = createSession({ cols: 80, rows: 24 });
      const chunk = 'x'.repeat(1024);
      const numChunks = Math.ceil(MAX_SCROLLBACK_CHARS / 1024) + 10;
      for (let i = 0; i < numChunks; i++) {
        appendScrollback(session, chunk);
      }
      expect(session.scrollbackChars).toBeLessThanOrEqual(MAX_SCROLLBACK_CHARS);
      expect(session.scrollback.length).toBeLessThan(numChunks);
    });

    it('concatenating scrollback gives correct result', () => {
      const session = createSession({ cols: 80, rows: 24 });
      appendScrollback(session, 'line 1\n');
      appendScrollback(session, 'line 2\n');
      expect(session.scrollback.join('')).toBe('line 1\nline 2\n');
    });

    it('handles empty scrollback', () => {
      const session = createSession({ cols: 80, rows: 24 });
      expect(session.scrollback.join('')).toBe('');
    });
  });

  describe('disconnect timer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('cleans up session after timeout', () => {
      const session = createSession({ cols: 80, rows: 24 });
      const mockKill = vi.fn();
      session.pty = { kill: mockKill };

      session.ws = null;
      session.disconnectTimer = setTimeout(() => {
        if (session.pty) session.pty.kill();
        deleteSession(session.id);
      }, DISCONNECT_TIMEOUT_MS);

      vi.advanceTimersByTime(DISCONNECT_TIMEOUT_MS);
      expect(mockKill).toHaveBeenCalled();
      expect(getSession(session.id)).toBeUndefined();
    });

    it('cancels disconnect timer on reconnect', () => {
      const session = createSession({ cols: 80, rows: 24 });
      const mockKill = vi.fn();
      session.pty = { kill: mockKill };

      session.disconnectTimer = setTimeout(() => {
        if (session.pty) session.pty.kill();
        deleteSession(session.id);
      }, DISCONNECT_TIMEOUT_MS);

      clearTimeout(session.disconnectTimer);
      session.disconnectTimer = null;

      vi.advanceTimersByTime(DISCONNECT_TIMEOUT_MS);
      expect(mockKill).not.toHaveBeenCalled();
      expect(getSession(session.id)).toBe(session);
    });
  });

  describe('output queuing during replay', () => {
    it('queues output when replaying is true', () => {
      const session = createSession({ cols: 80, rows: 24 });
      session.replaying = true;
      session.outputQueue.push('queued data 1');
      session.outputQueue.push('queued data 2');
      expect(session.outputQueue).toEqual(['queued data 1', 'queued data 2']);
    });

    it('outputQueue is empty by default', () => {
      const session = createSession({ cols: 80, rows: 24 });
      expect(session.outputQueue).toEqual([]);
      expect(session.replaying).toBe(false);
    });
  });

  describe('clearAllSessions', () => {
    it('removes all sessions', () => {
      createSession({ cols: 80, rows: 24 });
      createSession({ cols: 80, rows: 24 });
      expect(getSessionCount()).toBe(2);
      clearAllSessions();
      expect(getSessionCount()).toBe(0);
    });

    it('clears disconnect timers', () => {
      vi.useFakeTimers();
      const session = createSession({ cols: 80, rows: 24 });
      const mockKill = vi.fn();
      session.pty = { kill: mockKill };
      session.disconnectTimer = setTimeout(() => {}, 10000);

      clearAllSessions();
      expect(getSessionCount()).toBe(0);
      expect(mockKill).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('multiple concurrent sessions', () => {
    it('maintains independent sessions', () => {
      const s1 = createSession({ cols: 80, rows: 24 });
      const s2 = createSession({ cols: 120, rows: 40 });
      appendScrollback(s1, 'session 1 data');
      appendScrollback(s2, 'session 2 data');
      expect(s1.scrollback.join('')).toBe('session 1 data');
      expect(s2.scrollback.join('')).toBe('session 2 data');
      expect(s1.id).not.toBe(s2.id);
    });
  });
});
