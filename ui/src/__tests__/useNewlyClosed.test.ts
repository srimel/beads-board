import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNewlyClosed } from '@/components/KanbanBoard'
import type { BeadIssue } from '@/lib/types'

const makeIssue = (id: string): BeadIssue => ({
  id,
  title: `Issue ${id}`,
  status: 'closed',
  priority: 2,
  type: 'task',
})

describe('useNewlyClosed', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty set on first render (no celebration on initial load)', () => {
    const done = [makeIssue('a'), makeIssue('b')]
    const { result } = renderHook(() => useNewlyClosed(done))
    expect(result.current.size).toBe(0)
  })

  it('detects newly closed issues on second update', () => {
    const initial = [makeIssue('a')]
    const { result, rerender } = renderHook(
      ({ done }) => useNewlyClosed(done),
      { initialProps: { done: initial } }
    )

    // First render seeds the baseline
    expect(result.current.size).toBe(0)

    // Add a new closed issue
    const updated = [makeIssue('a'), makeIssue('b')]
    rerender({ done: updated })

    expect(result.current.size).toBe(1)
    expect(result.current.has('b')).toBe(true)
  })

  it('does NOT trigger celebration when filtered list shrinks and re-expands', () => {
    // This is the exact bug scenario: unfiltered list stays constant,
    // but filtered view hides then reveals items
    const allDone = [makeIssue('a'), makeIssue('b'), makeIssue('c')]

    const { result, rerender } = renderHook(
      ({ done }) => useNewlyClosed(done),
      { initialProps: { done: allDone } }
    )

    // Seed baseline
    expect(result.current.size).toBe(0)

    // Simulate: same unfiltered list passed again (search typed then cleared)
    rerender({ done: allDone })
    expect(result.current.size).toBe(0)
  })

  it('clears celebration after timeout', () => {
    vi.useFakeTimers()

    const initial = [makeIssue('a')]
    const { result, rerender } = renderHook(
      ({ done }) => useNewlyClosed(done),
      { initialProps: { done: initial } }
    )

    // Trigger a celebration
    rerender({ done: [makeIssue('a'), makeIssue('b')] })
    expect(result.current.size).toBe(1)

    // Advance past the 2s timeout
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.size).toBe(0)

    vi.useRealTimers()
  })

  it('does not trigger on reorder of same IDs', () => {
    const initial = [makeIssue('a'), makeIssue('b'), makeIssue('c')]
    const { result, rerender } = renderHook(
      ({ done }) => useNewlyClosed(done),
      { initialProps: { done: initial } }
    )

    expect(result.current.size).toBe(0)

    // Same issues in different order
    const reordered = [makeIssue('c'), makeIssue('a'), makeIssue('b')]
    rerender({ done: reordered })
    expect(result.current.size).toBe(0)
  })

  it('handles empty initial list then first data arrival without celebration', () => {
    const { result, rerender } = renderHook(
      ({ done }) => useNewlyClosed(done),
      { initialProps: { done: [] as BeadIssue[] } }
    )

    expect(result.current.size).toBe(0)

    // First data arrives — should seed, not celebrate
    rerender({ done: [makeIssue('a'), makeIssue('b')] })
    expect(result.current.size).toBe(0)
  })
})
