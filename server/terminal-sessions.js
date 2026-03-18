const { randomUUID } = require('node:crypto');

const MAX_SCROLLBACK_CHARS = 100 * 1024; // ~100KB for ASCII terminal output
const MAX_SESSIONS = 10;
const DISCONNECT_TIMEOUT_MS = 60 * 1000; // 60 seconds
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** @type {Map<string, Session>} */
const sessions = new Map();

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {import('node-pty').IPty|null} pty
 * @property {string[]} scrollback - ring buffer of output chunks
 * @property {number} scrollbackChars - total character count
 * @property {number} cols
 * @property {number} rows
 * @property {NodeJS.Timeout|null} disconnectTimer
 * @property {WebSocket|null} ws
 * @property {boolean} replaying
 * @property {string[]} outputQueue
 */

/**
 * Create a new terminal session.
 * @param {{ cols: number, rows: number, evictIdle?: boolean }} opts
 * @returns {Session}
 */
function createSession({ cols, rows, evictIdle = false }) {
  if (sessions.size >= MAX_SESSIONS) {
    if (evictIdle) {
      // Find oldest idle session (no ws connection)
      let oldestId = null;
      for (const [id, s] of sessions) {
        if (!s.ws) {
          oldestId = id;
          break; // first inserted = oldest (Map preserves insertion order)
        }
      }
      if (oldestId) {
        const old = sessions.get(oldestId);
        if (old.disconnectTimer) clearTimeout(old.disconnectTimer);
        if (old.pty) try { old.pty.kill(); } catch {}
        sessions.delete(oldestId);
      } else {
        throw new Error('Session limit reached: all sessions are active');
      }
    } else {
      throw new Error('Session limit reached');
    }
  }

  const id = randomUUID();
  /** @type {Session} */
  const session = {
    id,
    pty: null,
    scrollback: [],
    scrollbackChars: 0,
    cols,
    rows,
    disconnectTimer: null,
    ws: null,
    replaying: false,
    outputQueue: [],
  };
  sessions.set(id, session);
  return session;
}

/**
 * Validate that a string is a UUID format.
 * @param {string} id
 * @returns {boolean}
 */
function isValidSessionId(id) {
  return UUID_RE.test(id);
}

/**
 * Get a session by ID.
 * @param {string} id
 * @returns {Session|undefined}
 */
function getSession(id) {
  return sessions.get(id);
}

/**
 * Delete a session by ID.
 * @param {string} id
 */
function deleteSession(id) {
  const session = sessions.get(id);
  if (session) {
    if (session.disconnectTimer) clearTimeout(session.disconnectTimer);
    sessions.delete(id);
  }
}

/**
 * Append data to a session's scrollback ring buffer.
 * Trims from front when exceeding MAX_SCROLLBACK_CHARS.
 * @param {Session} session
 * @param {string} data
 */
function appendScrollback(session, data) {
  session.scrollback.push(data);
  session.scrollbackChars += data.length;

  // Trim from front if over limit
  while (session.scrollbackChars > MAX_SCROLLBACK_CHARS && session.scrollback.length > 1) {
    const removed = session.scrollback.shift();
    session.scrollbackChars -= removed.length;
  }
}

/**
 * Get the count of active sessions.
 * @returns {number}
 */
function getSessionCount() {
  return sessions.size;
}

/**
 * Clear all sessions (for testing/cleanup).
 */
function clearAllSessions() {
  for (const [, session] of sessions) {
    if (session.disconnectTimer) clearTimeout(session.disconnectTimer);
    if (session.pty) try { session.pty.kill(); } catch {}
  }
  sessions.clear();
}

module.exports = {
  createSession,
  getSession,
  deleteSession,
  isValidSessionId,
  appendScrollback,
  getSessionCount,
  clearAllSessions,
  MAX_SCROLLBACK_CHARS,
  MAX_SESSIONS,
  DISCONNECT_TIMEOUT_MS,
};
