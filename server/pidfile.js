const fs = require('node:fs');
const path = require('node:path');

/**
 * Creates a pidfile manager for the given project directory.
 * @param {string} projectDir - The project directory where .beads-board.pid lives.
 * @returns {object} Pidfile management functions.
 */
function createPidfileManager(projectDir) {
  const PIDFILE = path.join(projectDir, '.beads-board.pid');

  function writePidfile(port) {
    fs.writeFileSync(PIDFILE, JSON.stringify({ pid: process.pid, port }));
  }

  function removePidfile() {
    try { fs.unlinkSync(PIDFILE); } catch {}
  }

  function getRunningInstance() {
    try {
      const data = JSON.parse(fs.readFileSync(PIDFILE, 'utf8'));
      if (!data.pid) {
        removePidfile();
        return null;
      }
      // Check if process is still running (signal 0 throws if not running)
      process.kill(data.pid, 0);
      return data;
    } catch {
      removePidfile();
      return null;
    }
  }

  /**
   * Registers process-level handlers to ensure the pidfile is removed on exit.
   * Handles SIGTERM, SIGINT, uncaughtException, and unhandledRejection.
   * @param {function} [onBeforeExit] - Optional callback to run before exiting (e.g., PTY cleanup).
   */
  function registerCleanupHandlers(onBeforeExit) {
    function cleanup(exitCode) {
      if (onBeforeExit) {
        try { onBeforeExit(); } catch {}
      }
      removePidfile();
      process.exit(exitCode || 0);
    }

    process.on('SIGTERM', () => cleanup(0));
    process.on('SIGINT', () => cleanup(0));
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err);
      cleanup(1);
    });
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection:', reason);
      cleanup(1);
    });
  }

  return {
    writePidfile,
    removePidfile,
    getRunningInstance,
    registerCleanupHandlers,
    get pidfilePath() { return PIDFILE; },
  };
}

module.exports = { createPidfileManager };
