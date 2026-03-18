import { useMemo } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { BeadCard } from './BeadCard'
import type { BeadIssue } from '@/lib/types'
import type { CardSourceRect } from '@/App'

type SortMode = 'recent' | 'priority'

interface KanbanColumnHeaderProps {
  title: string
  count: number
  accentColor: string
  sortable?: boolean
  sortMode?: SortMode
  onToggleSort?: () => void
}

interface KanbanColumnProps {
  issues: BeadIssue[]
  loading?: boolean
  sortable?: boolean
  sortMode?: SortMode
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

export function KanbanColumnHeader({ title, count, accentColor, sortable, sortMode, onToggleSort }: KanbanColumnHeaderProps) {
  return (
    <div className={`min-w-0 flex-1 flex items-center gap-2 px-3 py-2 border-b-2 ${accentColor}`}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="text-xs text-muted-foreground">({count})</span>
      {sortable && (
        <button
          onClick={onToggleSort}
          title={sortMode === 'recent' ? 'Sorted by recent — click for priority' : 'Sorted by priority — click for recent'}
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowDownUp className="h-3 w-3" />
          <span>{sortMode === 'recent' ? 'Recent' : 'Priority'}</span>
        </button>
      )}
    </div>
  )
}

export function KanbanColumn({ issues, loading, sortable, sortMode = 'recent', onIssueClick, celebratingIds }: KanbanColumnProps) {
  const sortedIssues = useMemo(
    () => sortable ? sortIssues(issues, sortMode) : issues,
    [issues, sortMode, sortable]
  )

  return (
    <div className="min-w-0 flex-1">
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
    </div>
  )
}
