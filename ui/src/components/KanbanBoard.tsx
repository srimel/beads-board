import { useEffect, useRef, useState, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { KanbanColumn } from './KanbanColumn'
import type { BeadIssue } from '@/lib/types'
import type { CardSourceRect } from '@/App'

interface KanbanBoardProps {
  issues: BeadIssue[]
  ready: BeadIssue[]
  blocked: BeadIssue[]
  loading?: boolean
  onIssueClick?: (id: string, rect?: CardSourceRect) => void
}

/**
 * Tracks which issue IDs just moved to "closed" status between poll cycles.
 * On the very first render we seed the set without flagging anything as "new".
 */
function useNewlyClosed(done: BeadIssue[]): Set<string> {
  const prevClosedIds = useRef<Set<string> | null>(null)
  const [newlyClosed, setNewlyClosed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const currentIds = new Set(done.map(i => i.id))

    if (prevClosedIds.current === null) {
      // First load — seed without triggering celebrations
      prevClosedIds.current = currentIds
      return
    }

    const freshlyDone = new Set<string>()
    for (const id of currentIds) {
      if (!prevClosedIds.current.has(id)) {
        freshlyDone.add(id)
      }
    }

    prevClosedIds.current = currentIds

    if (freshlyDone.size > 0) {
      setNewlyClosed(freshlyDone)
      // Auto-clear after animation duration
      const timer = setTimeout(() => setNewlyClosed(new Set()), 2000)
      return () => clearTimeout(timer)
    }
  }, [done])

  return newlyClosed
}

export function KanbanBoard({ issues, ready, blocked: _, loading, onIssueClick }: KanbanBoardProps) {
  const readyIds = new Set(ready.map(i => i.id))
  const inProgress = issues.filter(i => i.status === 'in_progress')
  const done = issues.filter(i => i.status === 'closed')

  const newlyClosed = useNewlyClosed(done)

  const handleCelebrationDone = useCallback((id: string) => {
    // Animation auto-clears via the timeout in useNewlyClosed
    void id
  }, [])

  // Backlog: everything that isn't ready, in_progress, or closed
  const backlog = issues.filter(i =>
    i.status !== 'in_progress' &&
    i.status !== 'closed' &&
    !readyIds.has(i.id)
  )

  return (
    <ScrollArea className="h-full">
      <div className="flex gap-3">
        <KanbanColumn
          title="Backlog"
          issues={backlog}
          accentColor="border-[#7d8590]"
          loading={loading}
          onIssueClick={onIssueClick}
        />
        <KanbanColumn
          title="Ready"
          issues={ready}
          accentColor="border-[#238636]"
          loading={loading}
          onIssueClick={onIssueClick}
        />
        <KanbanColumn
          title="In Progress"
          issues={inProgress}
          accentColor="border-[#1f6feb]"
          loading={loading}
          onIssueClick={onIssueClick}
        />
        <KanbanColumn
          title="Done"
          issues={done}
          accentColor="border-[#484f58]"
          loading={loading}
          sortable
          onIssueClick={onIssueClick}
          celebratingIds={newlyClosed}
          onCelebrationDone={handleCelebrationDone}
        />
      </div>
    </ScrollArea>
  )
}
