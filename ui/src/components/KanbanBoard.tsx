import { ScrollArea } from '@/components/ui/scroll-area'
import { KanbanColumn } from './KanbanColumn'
import type { BeadIssue } from '@/lib/types'

interface KanbanBoardProps {
  issues: BeadIssue[]
  ready: BeadIssue[]
  blocked: BeadIssue[]
  loading?: boolean
}

export function KanbanBoard({ issues, ready, blocked, loading }: KanbanBoardProps) {
  const inProgress = issues.filter(i => i.status === 'in_progress')
  const done = issues.filter(i => i.status === 'closed')

  return (
    <ScrollArea className="h-full">
      <div className="flex gap-3">
        <KanbanColumn
          title="Ready"
          issues={ready}
          accentColor="border-green-500"
          loading={loading}
        />
        <KanbanColumn
          title="In Progress"
          issues={inProgress}
          accentColor="border-blue-500"
          loading={loading}
        />
        <KanbanColumn
          title="Blocked"
          issues={blocked}
          accentColor="border-amber-500"
          loading={loading}
        />
        <KanbanColumn
          title="Done"
          issues={done}
          accentColor="border-muted-foreground"
          loading={loading}
        />
      </div>
    </ScrollArea>
  )
}
