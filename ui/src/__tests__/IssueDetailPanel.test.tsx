import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

  it('renders scrollable content area with correct classes when content is present', async () => {
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

    // Uses a plain div with overflow-y-auto instead of Radix ScrollArea
    // (Radix viewport height: 100% doesn't resolve correctly in flex containers)
    const scrollDiv = container.querySelector('.overflow-y-auto')
    expect(scrollDiv).toBeInTheDocument()
    expect(scrollDiv!.className).toContain('flex-1')
    expect(scrollDiv!.className).toContain('min-h-0')
    expect(scrollDiv!.className).toContain('scrollbar-thin')
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

  it('shows edit button next to description heading', async () => {
    render(
      <IssueDetailPanel
        issueId="bd-test1"
        open={true}
        onClose={() => {}}
        issues={[mockIssue]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Test Issue Title')).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /edit description/i })
    expect(editButton).toBeInTheDocument()
  })

  it('enters edit mode with textarea and save/cancel buttons on edit click', async () => {
    render(
      <IssueDetailPanel
        issueId="bd-test1"
        open={true}
        onClose={() => {}}
        issues={[mockIssue]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Test Issue Title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /edit description/i }))

    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('A test description that could be very long')
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('cancel exits edit mode without saving', async () => {
    render(
      <IssueDetailPanel
        issueId="bd-test1"
        open={true}
        onClose={() => {}}
        issues={[mockIssue]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Test Issue Title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /edit description/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Changed text' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    // Should exit edit mode and show original description
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('A test description that could be very long')).toBeInTheDocument()
  })

  it('save calls PATCH API and exits edit mode', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockDetailResponse) }) // initial fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) }) // PATCH

    globalThis.fetch = fetchMock

    render(
      <IssueDetailPanel
        issueId="bd-test1"
        open={true}
        onClose={() => {}}
        issues={[mockIssue]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Test Issue Title')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /edit description/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated description' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/issue/bd-test1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ description: 'Updated description' }),
        })
      )
    })
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
