import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { IssueDetailPanel } from '@/components/IssueDetailPanel'
import type { BeadIssue } from '@/lib/types'

// Mock framer-motion to render children directly without animation
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: (props: any) => {
      const { children, className, role, onAnimationComplete } = props
      // Simulate animation completing immediately
      if (onAnimationComplete) {
        setTimeout(() => onAnimationComplete(), 0)
      }
      return (
        <div
          className={className}
          role={role}
          aria-modal={props['aria-modal']}
          aria-labelledby={props['aria-labelledby']}
        >
          {children}
        </div>
      )
    },
  },
}))

const mockIssue: BeadIssue = {
  id: 'bd-test1',
  title: 'Test Issue Title',
  status: 'open',
  priority: 2,
  type: 'task',
  issue_type: 'task',
  description: 'A test description that could be very long',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-02T00:00:00Z',
}

const mockDetailResponse = {
  id: 'bd-test1',
  title: 'Test Issue Title',
  status: 'open',
  priority: 2,
  issue_type: 'task',
  description: 'A test description that could be very long',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-02T00:00:00Z',
}

beforeEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockDetailResponse),
  })
})

describe('IssueDetailPanel', () => {
  it('renders with flex column layout on the modal container', async () => {
    render(
      <IssueDetailPanel
        issueId="bd-test1"
        open={true}
        onClose={() => {}}
        issues={[mockIssue]}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    // Modal should have flex flex-col for proper height constraint
    expect(dialog.className).toContain('flex')
    expect(dialog.className).toContain('flex-col')
    // Should still have overflow-hidden for animation clipping
    expect(dialog.className).toContain('overflow-hidden')
    expect(dialog.className).toContain('max-h-[85vh]')
  })

  it('renders ScrollArea with flex-1 and min-h-0 classes when content is present', async () => {
    const { container } = render(
      <IssueDetailPanel
        issueId="bd-test1"
        open={true}
        onClose={() => {}}
        issues={[mockIssue]}
      />
    )

    // Wait for content to be ready (list data used as placeholder)
    await waitFor(() => {
      expect(screen.getByText('Test Issue Title')).toBeInTheDocument()
    })

    const scrollArea = container.querySelector('[data-slot="scroll-area"]')
    expect(scrollArea).toBeInTheDocument()
    // ScrollArea should use flex-1 min-h-0 instead of max-h-[80vh]
    expect(scrollArea!.className).toContain('flex-1')
    expect(scrollArea!.className).toContain('min-h-0')
    // Should NOT have max-h-[80vh] anymore
    expect(scrollArea!.className).not.toContain('max-h-[80vh]')
  })

  it('renders loading skeleton when content is not ready', () => {
    const { container } = render(
      <IssueDetailPanel
        issueId="bd-unknown"
        open={true}
        onClose={() => {}}
        issues={[]}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    // Loading skeleton should have animate-pulse
    const skeleton = container.querySelector('[class*="animate-pulse"]')
    expect(skeleton).toBeInTheDocument()
  })

  it('renders "Issue not found" when detail is null after loading', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    })

    render(
      <IssueDetailPanel
        issueId="bd-notfound"
        open={true}
        onClose={() => {}}
        issues={[]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Issue not found')).toBeInTheDocument()
    })
  })
})
