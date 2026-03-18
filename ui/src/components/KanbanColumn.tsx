import { useState, useMemo } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BeadCard } from './BeadCard'
import type { BeadIssue } from '@/lib/types'
import type { CardSourceRect } from '@/App'

type SortMode = 'recent' | 'priority'

interface KanbanColumnProps {
  title: string
  issues: BeadIssue[]
  accentColor: string
  loading?: boolean
  sortable?: boolean
  onIssueClick?: (id: string, rect?: CardSourceRect) => void
  celebratingIds?: Set<string>
}

function sortIssues(issues: BeadIssue[], mode: SortMode): BeadIssue[] {
  return [...issues].sort((a, b) => {
    if (mode === 'priority') {
      const pDiff = (a.priority ?? 4) - (b.priority ?? 4)
      if (pDiff !== 0) return pDiff
      // tie-break by updated_at desc
      return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
    }
    // recent: sort by updated_at desc
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
  })
}

export function KanbanColumn({ title, issues, accentColor, loading, sortable, onIssueClick, celebratingIds }: KanbanColumnProps) {
  const [sortMode, setSortMode] = useState<SortMode>('recent')

  const sortedIssues = useMemo(
    () => sortable ? sortIssues(issues, sortMode) : issues,
    [issues, sortMode, sortable]
  )

  const toggleSort = () => setSortMode(m => m === 'recent' ? 'priority' : 'recent')

  return (
    <div className="min-w-0 flex-1 flex flex-col">
      <div className={`flex items-center gap-2 px-3 py-2 border-b-2 shrink-0 bg-background ${accentColor}`}>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">({issues.length})</span>
        {sortable && (
          <button
            onClick={toggleSort}
            title={sortMode === 'recent' ? 'Sorted by recent — click for priority' : 'Sorted by priority — click for recent'}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowDownUp className="h-3 w-3" />
            <span>{sortMode === 'recent' ? 'Recent' : 'Priority'}</span>
          </button>
        )}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 mb-2 rounded-lg" />
            ))
          ) : sortedIssues.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No issues</p>
          ) : (
            sortedIssues.map(issue => (
              <BeadCard
                key={issue.id}
                issue={issue}
                onClick={onIssueClick}
                celebrating={celebratingIds?.has(issue.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
