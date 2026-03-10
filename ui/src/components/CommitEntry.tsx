import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import type { GitCommit } from '@/lib/types'

const BEAD_ID_REGEX = /\b([\w]+-[\w]+-[a-z0-9]{2,8})\b/g

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function renderMessage(message: string, onBeadClick?: (beadId: string) => void) {
  const parts = message.split(BEAD_ID_REGEX)
  return parts.map((part, i) => {
    if (BEAD_ID_REGEX.test(part)) {
      BEAD_ID_REGEX.lastIndex = 0
      return (
        <Badge
          key={i}
          variant="outline"
          className={
            onBeadClick
              ? "mx-0.5 text-xs cursor-pointer hover:underline hover:bg-accent/50 transition-colors"
              : "mx-0.5 text-xs"
          }
          onClick={onBeadClick ? (e: React.MouseEvent) => { e.stopPropagation(); onBeadClick(part) } : undefined}
        >
          {part}
        </Badge>
      )
    }
    return <span key={i}>{part}</span>
  })
}

interface CommitEntryProps {
  commit: GitCommit
  onBeadClick?: (beadId: string) => void
}

export function CommitEntry({ commit, onBeadClick }: CommitEntryProps) {
  return (
    <div className="flex flex-col gap-0.5 py-2 px-3 border-b border-border last:border-0 animate-bead-enter">
      <div className="flex items-center gap-2">
        <code className="text-xs text-muted-foreground shrink-0">{commit.hash}</code>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {formatRelativeTime(commit.date)}
        </span>
      </div>
      {commit.body ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-sm leading-tight truncate cursor-help">{renderMessage(commit.message, onBeadClick)}</p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm whitespace-pre-wrap text-xs">
              <p className="font-semibold mb-1">{commit.message}</p>
              <p>{commit.body}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <p className="text-sm leading-tight">{renderMessage(commit.message, onBeadClick)}</p>
      )}
      <span className="text-xs text-muted-foreground">{commit.author}</span>
    </div>
  )
}
