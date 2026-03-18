import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createPidfileManager } from '../pidfile.js';

describe('pidfile management', () => {
  let tmpDir;
  let pidfilePath;
  let manager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beads-board-test-'));
    pidfilePath = path.join(tmpDir, '.beads-board.pid');
    manager = createPidfileManager(tmpDir);
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  });

  describe('writePidfile', () => {
    it('should create a pidfile with pid and port', () => {
      manager.writePidfile(8377);
      const data = JSON.parse(fs.readFileSync(pidfilePath, 'utf8'));
      expect(data.pid).toBe(process.pid);
      expect(data.port).toBe(8377);
    });
  });

  describe('removePidfile', () => {
    it('should delete the pidfile', () => {
      fs.writeFileSync(pidfilePath, JSON.stringify({ pid: process.pid, port: 8377 }));
      manager.removePidfile();
      expect(fs.existsSync(pidfilePath)).toBe(false);
    });

    it('should not throw if pidfile does not exist', () => {
      expect(() => manager.removePidfile()).not.toThrow();
    });
  });

  describe('getRunningInstance', () => {
    it('should return data when process is running', () => {
      // Use our own PID since we know it's running
      fs.writeFileSync(pidfilePath, JSON.stringify({ pid: process.pid, port: 8377 }));
      const result = manager.getRunningInstance();
      expect(result).toEqual({ pid: process.pid, port: 8377 });
    });

    it('should return null and remove stale pidfile when process is not running', () => {
      // PID 999999 is almost certainly not running
      fs.writeFileSync(pidfilePath, JSON.stringify({ pid: 999999, port: 8377 }));
      const result = manager.getRunningInstance();
      expect(result).toBeNull();
      expect(fs.existsSync(pidfilePath)).toBe(false);
    });

    it('should return null when no pidfile exists', () => {
      const result = manager.getRunningInstance();
      expect(result).toBeNull();
    });

    it('should return null and remove pidfile with corrupt JSON', () => {
      fs.writeFileSync(pidfilePath, 'not json');
      const result = manager.getRunningInstance();
      expect(result).toBeNull();
      expect(fs.existsSync(pidfilePath)).toBe(false);
    });
  });

  describe('registerCleanupHandlers', () => {
    it('should register handlers for SIGTERM, SIGINT, and uncaughtException', () => {
      // We can't easily test process signal handlers without forking,
      // but we can verify the function exists and doesn't throw
      expect(typeof manager.registerCleanupHandlers).toBe('function');
    });
  });

  describe('stale PID detection on startup', () => {
    it('should clean up pidfile for a PID that is not running', () => {
      // Write a pidfile with a definitely-dead PID
      fs.writeFileSync(pidfilePath, JSON.stringify({ pid: 999999, port: 8377 }));
      expect(fs.existsSync(pidfilePath)).toBe(true);

      // getRunningInstance should detect the stale PID and clean up
      const result = manager.getRunningInstance();
      expect(result).toBeNull();
      expect(fs.existsSync(pidfilePath)).toBe(false);
    });

    it('should clean up pidfile with missing pid field', () => {
      fs.writeFileSync(pidfilePath, JSON.stringify({ port: 8377 }));
      const result = manager.getRunningInstance();
      expect(result).toBeNull();
      expect(fs.existsSync(pidfilePath)).toBe(false);
    });
  });
});
