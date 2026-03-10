import { useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import type { BeadIssue } from '@/lib/types'
import type { CardSourceRect } from '@/App'

const PRIORITY_COLORS: Record<number, string> = {
  0: 'text-[#f85149]',
  1: 'text-[#e3b341]',
  2: 'text-[#58a6ff]',
  3: 'text-[#7d8590]',
  4: 'text-muted-foreground',
}

const TYPE_STYLES: Record<string, string> = {
  bug: 'bg-[#da3633]/15 text-[#f85149] border-[#da3633]/30',
  feature: 'bg-[#8957e5]/15 text-[#bc8cff] border-[#8957e5]/30',
  task: 'bg-[#2dd4bf]/15 text-[#5eead4] border-[#2dd4bf]/30',
  epic: 'bg-[#d29922]/15 text-[#e3b341] border-[#d29922]/30',
  chore: 'bg-[#7d8590]/15 text-[#7d8590] border-[#7d8590]/30',
}

export function BeadCard({ issue, onClick }: { issue: BeadIssue; onClick?: (id: string, rect?: CardSourceRect) => void }) {
  const depCount = issue.dependencies?.length || 0
  const cardRef = useRef<HTMLDivElement>(null)

  const handleClick = () => {
    if (!onClick) return
    const el = cardRef.current
    if (el) {
      const rect = el.getBoundingClientRect()
      onClick(issue.id, { top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    } else {
      onClick(issue.id)
    }
  }

  return (
    <Card
      ref={cardRef}
      className="mb-2 p-2.5 gap-1 border-border animate-bead-enter cursor-pointer hover:border-primary/50 transition-colors"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between gap-2">
        <code className="text-xs text-muted-foreground">{issue.id}</code>
        <span className={`text-xs font-semibold ${PRIORITY_COLORS[issue.priority] || PRIORITY_COLORS[4]}`}>
          P{issue.priority}
        </span>
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
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
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
