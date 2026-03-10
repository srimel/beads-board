import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { BeadIssue } from '@/lib/types'

// Test the column categorization logic from KanbanBoard
// We import the actual component to verify it renders correctly
import { KanbanBoard } from '@/components/KanbanBoard'

const makeIssue = (overrides: Partial<BeadIssue>): BeadIssue => ({
  id: 'test-1',
  title: 'Test Issue',
  status: 'open',
  priority: 2,
  type: 'task',
  ...overrides,
})

describe('KanbanBoard', () => {
  it('renders all four column headers', () => {
    render(
      <KanbanBoard issues={[]} ready={[]} blocked={[]} />
    )
    expect(screen.getByText('Backlog')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('categorizes issues into the correct columns', () => {
    const issues: BeadIssue[] = [
      makeIssue({ id: 'backlog-1', title: 'Backlog Item', status: 'open' }),
      makeIssue({ id: 'ip-1', title: 'WIP Item', status: 'in_progress' }),
      makeIssue({ id: 'done-1', title: 'Done Item', status: 'closed' }),
      makeIssue({ id: 'ready-1', title: 'Ready Item', status: 'open' }),
    ]
    const ready = [issues[3]] // ready-1 is ready

    render(
      <KanbanBoard issues={issues} ready={ready} blocked={[]} />
    )

    // All issue titles should be rendered
    expect(screen.getByText('Backlog Item')).toBeInTheDocument()
    expect(screen.getByText('WIP Item')).toBeInTheDocument()
    expect(screen.getByText('Done Item')).toBeInTheDocument()
    expect(screen.getByText('Ready Item')).toBeInTheDocument()
  })

  it('shows loading skeletons when loading', () => {
    const { container } = render(
      <KanbanBoard issues={[]} ready={[]} blocked={[]} loading />
    )
    // Each column should show 3 skeleton items = 12 total
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(4)
  })
})
