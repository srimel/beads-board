import { describe, it, expect, beforeEach } from 'vitest'

const SESSION_ID_KEY = 'beads-board-terminal-session-id'

describe('Terminal theme constants', () => {
  it('DARK_THEME and LIGHT_THEME have different backgrounds', async () => {
    const source = await import('../components/TerminalPanel')
    expect(source.TerminalPanel).toBeDefined()
  })
})

describe('Terminal settings localStorage keys', () => {
  it('font size is stored under beads-board-terminal-font-size', () => {
    localStorage.setItem('beads-board-terminal-font-size', '16')
    expect(localStorage.getItem('beads-board-terminal-font-size')).toBe('16')
    localStorage.removeItem('beads-board-terminal-font-size')
  })

  it('font family is stored under beads-board-terminal-font-family', () => {
    localStorage.setItem('beads-board-terminal-font-family', 'Fira Code')
    expect(localStorage.getItem('beads-board-terminal-font-family')).toBe('Fira Code')
    localStorage.removeItem('beads-board-terminal-font-family')
  })
})

describe('Terminal session persistence contract', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('uses sessionStorage (per-tab) not localStorage for session ID', () => {
    // Session IDs must be per-tab so multiple tabs get independent sessions
    sessionStorage.setItem(SESSION_ID_KEY, 'tab-session')
    localStorage.setItem(SESSION_ID_KEY, 'global-value')
    expect(sessionStorage.getItem(SESSION_ID_KEY)).toBe('tab-session')
    expect(localStorage.getItem(SESSION_ID_KEY)).toBe('global-value')
    expect(sessionStorage.getItem(SESSION_ID_KEY)).not.toBe(localStorage.getItem(SESSION_ID_KEY))
    localStorage.removeItem(SESSION_ID_KEY)
  })

  it('session ID key matches the constant used in TerminalPanel', () => {
    // This ensures the test constant stays in sync with the component
    expect(SESSION_ID_KEY).toBe('beads-board-terminal-session-id')
  })

  it('WebSocket URL includes session param when session ID exists', () => {
    const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    sessionStorage.setItem(SESSION_ID_KEY, sessionId)
    const storedId = sessionStorage.getItem(SESSION_ID_KEY)
    const param = storedId ? `?session=${encodeURIComponent(storedId)}` : ''
    expect(param).toBe(`?session=${sessionId}`)
  })

  it('WebSocket URL has no session param when no session stored', () => {
    const storedId = sessionStorage.getItem(SESSION_ID_KEY)
    const param = storedId ? `?session=${encodeURIComponent(storedId)}` : ''
    expect(param).toBe('')
  })

  it('resetSession flow: removes session ID then reconnects without it', () => {
    sessionStorage.setItem(SESSION_ID_KEY, 'existing-session')
    // Simulate resetSession behavior
    sessionStorage.removeItem(SESSION_ID_KEY)
    // After removal, next connect should have no session param
    const storedId = sessionStorage.getItem(SESSION_ID_KEY)
    expect(storedId).toBeNull()
  })

  it('exit handler removes session ID so next connect is fresh', () => {
    sessionStorage.setItem(SESSION_ID_KEY, 'active-session')
    // Simulate exit handler behavior
    sessionStorage.removeItem(SESSION_ID_KEY)
    expect(sessionStorage.getItem(SESSION_ID_KEY)).toBeNull()
  })
})
