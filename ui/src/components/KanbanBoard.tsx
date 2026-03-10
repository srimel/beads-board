import { ScrollArea } from '@/components/ui/scroll-area'
import { KanbanColumn } from './KanbanColumn'
import type { BeadIssue } from '@/lib/types'

interface KanbanBoardProps {
  issues: BeadIssue[]
  ready: BeadIssue[]
  blocked: BeadIssue[]
  loading?: boolean
  onIssueClick?: (id: string) => void
}

export function KanbanBoard({ issues, ready, blocked: _, loading, onIssueClick }: KanbanBoardProps) {
  const readyIds = new Set(ready.map(i => i.id))
  const inProgress = issues.filter(i => i.status === 'in_progress')
  const done = issues.filter(i => i.status === 'closed')

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
          onIssueClick={onIssueClick}
        />
      </div>
    </ScrollArea>
  )
}
