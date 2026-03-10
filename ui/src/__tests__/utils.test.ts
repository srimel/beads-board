import { describe, it, expect } from 'vitest'

// Test the BEAD_ID_REGEX pattern used in CommitEntry
const BEAD_ID_REGEX = /\b([\w]+-[\w]+-[a-z0-9]{2,8})\b/g

describe('BEAD_ID_REGEX', () => {
  it('matches bead IDs in commit messages', () => {
    const message = 'fix: resolve crash on startup (beads-board-6h1)'
    const matches = message.match(BEAD_ID_REGEX)
    expect(matches).toEqual(['beads-board-6h1'])
  })

  it('matches multiple bead IDs', () => {
    const message = 'feat: beads-board-20a and beads-board-8uj'
    const matches = message.match(BEAD_ID_REGEX)
    expect(matches).toEqual(['beads-board-20a', 'beads-board-8uj'])
  })

  it('does not match strings without two hyphens', () => {
    const message = 'fix: update readme'
    const matches = message.match(BEAD_ID_REGEX)
    expect(matches).toBeNull()
  })
})

// Test formatRelativeTime logic (extracted from CommitEntry)
function formatRelativeTime(dateStr: string, now: Date): string {
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

describe('formatRelativeTime', () => {
  const now = new Date('2026-03-10T12:00:00Z')

  it('returns "just now" for times less than a minute ago', () => {
    expect(formatRelativeTime('2026-03-10T11:59:30Z', now)).toBe('just now')
  })

  it('returns minutes for times less than an hour ago', () => {
    expect(formatRelativeTime('2026-03-10T11:45:00Z', now)).toBe('15m ago')
  })

  it('returns hours for times less than a day ago', () => {
    expect(formatRelativeTime('2026-03-10T09:00:00Z', now)).toBe('3h ago')
  })

  it('returns days for times more than a day ago', () => {
    expect(formatRelativeTime('2026-03-08T12:00:00Z', now)).toBe('2d ago')
  })
})

// Test sortIssues logic (extracted from KanbanColumn)
import type { BeadIssue } from '@/lib/types'

type SortMode = 'recent' | 'priority'

function sortIssues(issues: BeadIssue[], mode: SortMode): BeadIssue[] {
  return [...issues].sort((a, b) => {
    if (mode === 'priority') {
      const pDiff = (a.priority ?? 4) - (b.priority ?? 4)
      if (pDiff !== 0) return pDiff
      return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
    }
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
  })
}

const makeIssue = (overrides: Partial<BeadIssue>): BeadIssue => ({
  id: 'test-issue-1',
  title: 'Test',
  status: 'open',
  priority: 2,
  type: 'task',
  ...overrides,
})

describe('sortIssues', () => {
  const issues: BeadIssue[] = [
    makeIssue({ id: 'a', priority: 2, updated_at: '2026-03-09T10:00:00Z' }),
    makeIssue({ id: 'b', priority: 0, updated_at: '2026-03-08T10:00:00Z' }),
    makeIssue({ id: 'c', priority: 1, updated_at: '2026-03-10T10:00:00Z' }),
  ]

  it('sorts by priority ascending', () => {
    const sorted = sortIssues(issues, 'priority')
    expect(sorted.map(i => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by recent (updated_at descending)', () => {
    const sorted = sortIssues(issues, 'recent')
    expect(sorted.map(i => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('does not mutate the original array', () => {
    const original = [...issues]
    sortIssues(issues, 'priority')
    expect(issues).toEqual(original)
  })
})
