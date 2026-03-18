import { useEffect, useRef, useState, useMemo } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { KanbanColumn, KanbanColumnHeader } from './KanbanColumn'
import type { BeadIssue } from '@/lib/types'
import type { CardSourceRect } from '@/App'

interface KanbanBoardProps {
  issues: BeadIssue[]
  allIssues?: BeadIssue[]
  ready: BeadIssue[]
  blocked: BeadIssue[]
  loading?: boolean
  onIssueClick?: (id: string, rect?: CardSourceRect) => void
}

/**
 * Tracks which issue IDs just moved to "closed" status between poll cycles.
 * Uses a stable key derived from sorted IDs to avoid spurious effect runs.
 */
export function useNewlyClosed(done: BeadIssue[]): Set<string> {
  // Create a stable key from the sorted set of closed IDs so the effect
  // only runs when the actual set of closed issues changes, not on every render.
  const doneIds = useMemo(() => done.map(i => i.id).sort(), [done])
  const doneKey = doneIds.join(',')

  const prevClosedIds = useRef<Set<string> | null>(null)
  const [newlyClosed, setNewlyClosed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const currentIds = new Set(doneIds)

    if (prevClosedIds.current === null || prevClosedIds.current.size === 0) {
      // First load or first data arrival — seed without triggering celebrations
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
      const timer = setTimeout(() => setNewlyClosed(new Set()), 2000)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey])

  return newlyClosed
}

export function KanbanBoard({ issues, allIssues, ready, blocked: _, loading, onIssueClick }: KanbanBoardProps) {
  const readyIds = new Set(ready.map(i => i.id))
  const inProgress = issues.filter(i => i.status === 'in_progress')
  const done = issues.filter(i => i.status === 'closed')

  // Track celebrations against unfiltered issues so filter changes don't trigger false positives
  const allDone = useMemo(() => (allIssues || issues).filter(i => i.status === 'closed'), [allIssues, issues])
  const newlyClosed = useNewlyClosed(allDone)

  // Backlog: everything that isn't ready, in_progress, or closed
  const backlog = issues.filter(i =>
    i.status !== 'in_progress' &&
    i.status !== 'closed' &&
    !readyIds.has(i.id)
  )

  const columns = [
    { title: 'Backlog', issues: backlog, accentColor: 'border-[#7d8590]' },
    { title: 'Ready', issues: ready, accentColor: 'border-[#238636]' },
    { title: 'In Progress', issues: inProgress, accentColor: 'border-[#1f6feb]' },
    { title: 'Done', issues: done, accentColor: 'border-[#484f58]', sortable: true, celebratingIds: newlyClosed },
  ] as const

  const [sortMode, setSortMode] = useState<'recent' | 'priority'>('recent')
  const toggleSort = () => setSortMode(m => m === 'recent' ? 'priority' : 'recent')

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header row */}
      <div className="flex gap-2 shrink-0">
        {columns.map(col => (
          <KanbanColumnHeader
            key={col.title}
            title={col.title}
            count={col.issues.length}
            accentColor={col.accentColor}
            sortable={'sortable' in col && col.sortable}
            sortMode={sortMode}
            onToggleSort={toggleSort}
          />
        ))}
      </div>
      {/* Single scroll area for all columns */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex gap-2 pr-3">
          {columns.map(col => (
            <KanbanColumn
              key={col.title}
              issues={col.issues}
              loading={loading}
              onIssueClick={onIssueClick}
              sortable={'sortable' in col && col.sortable}
              sortMode={sortMode}
              celebratingIds={'celebratingIds' in col ? col.celebratingIds : undefined}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
