import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { BeadCard } from './BeadCard'
import type { BeadIssue } from '@/lib/types'

interface KanbanColumnProps {
  title: string
  issues: BeadIssue[]
  accentColor: string
  loading?: boolean
}

export function KanbanColumn({ title, issues, accentColor, loading }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-0 min-h-0 flex-1 overflow-hidden">
      <div className={`flex items-center gap-2 px-3 py-2 border-b-2 shrink-0 ${accentColor}`}>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">({issues.length})</span>
      </div>
      <ScrollArea className="flex-1 min-h-0 overflow-hidden p-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 mb-2 rounded-lg" />
          ))
        ) : issues.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No issues</p>
        ) : (
          issues.map(issue => <BeadCard key={issue.id} issue={issue} />)
        )}
      </ScrollArea>
    </div>
  )
}
