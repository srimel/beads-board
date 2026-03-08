import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import type { BeadIssue } from '@/lib/types'

const PRIORITY_STYLES: Record<number, string> = {
  0: 'bg-red-600 text-white',
  1: 'bg-orange-500 text-white',
  2: 'bg-yellow-500 text-black',
  3: 'bg-blue-500 text-white',
  4: 'bg-muted text-muted-foreground',
}

const TYPE_STYLES: Record<string, string> = {
  bug: 'bg-red-500/20 text-red-400 border-red-500/30',
  feature: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  task: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  epic: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  chore: 'bg-muted text-muted-foreground',
}

export function BeadCard({ issue }: { issue: BeadIssue }) {
  const depCount = issue.dependencies?.length || 0

  return (
    <Card className="mb-2">
      <CardHeader className="p-3 pb-1">
        <div className="flex items-center justify-between gap-2">
          <code className="text-xs text-muted-foreground">{issue.id}</code>
          <Badge className={PRIORITY_STYLES[issue.priority] || PRIORITY_STYLES[4]}>
            P{issue.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-sm font-medium leading-tight line-clamp-2">{issue.title}</p>
            </TooltipTrigger>
            <TooltipContent>
              <p>{issue.title}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className={TYPE_STYLES[issue.type] || ''}>
            {issue.type}
          </Badge>
          {depCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {depCount} dep{depCount > 1 ? 's' : ''}
            </span>
          )}
          {issue.assignee && (
            <span className="text-xs text-muted-foreground ml-auto">
              {issue.assignee}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
