import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import type { BeadIssue } from '@/lib/types'

const PRIORITY_STYLES: Record<number, string> = {
  0: 'bg-[#da3633]/20 text-[#f85149] border border-[#da3633]/40',
  1: 'bg-[#d29922]/20 text-[#e3b341] border border-[#d29922]/40',
  2: 'bg-[#388bfd]/20 text-[#58a6ff] border border-[#388bfd]/40',
  3: 'bg-[#7d8590]/20 text-[#7d8590] border border-[#7d8590]/40',
  4: 'bg-muted text-muted-foreground',
}

const TYPE_STYLES: Record<string, string> = {
  bug: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/30',
  feature: 'bg-[#8957e5]/15 text-[#bc8cff] border-[#8957e5]/30',
  task: 'bg-[#388bfd]/15 text-[#58a6ff] border-[#388bfd]/30',
  epic: 'bg-[#d29922]/15 text-[#e3b341] border-[#d29922]/30',
  chore: 'bg-[#7d8590]/15 text-[#7d8590] border-[#7d8590]/30',
}

export function BeadCard({ issue }: { issue: BeadIssue }) {
  const depCount = issue.dependencies?.length || 0

  return (
    <Card className="mb-2 p-2.5 gap-1 border-[#21262d]">
      <div className="flex items-center justify-between gap-2">
        <code className="text-xs text-muted-foreground">{issue.id}</code>
        <Badge className={PRIORITY_STYLES[issue.priority] || PRIORITY_STYLES[4]}>
          P{issue.priority}
        </Badge>
      </div>
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
      <div className="flex items-center gap-1.5 flex-wrap">
        {issue.type && (
          <Badge variant="outline" className={TYPE_STYLES[issue.type] || ''}>
            {issue.type}
          </Badge>
        )}
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
    </Card>
  )
}
