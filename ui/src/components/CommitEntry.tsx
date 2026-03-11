import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import type { GitCommit } from '@/lib/types'

const BEAD_ID_PATTERN = /\b([\w]+-[\w]+-[a-z0-9]{2,8})\b/

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
  const parts = message.split(new RegExp(BEAD_ID_PATTERN.source, 'g'))
  return parts.map((part, i) => {
    if (BEAD_ID_PATTERN.test(part)) {
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

function extractBeadIds(message: string): string[] {
  const ids: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(BEAD_ID_PATTERN.source, 'g')
  while ((match = re.exec(message)) !== null) {
    ids.push(match[1])
  }
  return ids
}

interface CommitEntryProps {
  commit: GitCommit
  onBeadClick?: (beadId: string) => void
  highlightedBeadId?: string | null
}

export function CommitEntry({ commit, onBeadClick, highlightedBeadId }: CommitEntryProps) {
  const beadIds = extractBeadIds(commit.message)
  const isHighlighted = highlightedBeadId ? beadIds.includes(highlightedBeadId) : false

  return (
    <div
      className={`flex flex-col gap-0.5 py-2 px-3 border-b border-border last:border-0 animate-bead-enter min-w-0 transition-colors ${isHighlighted ? 'animate-commit-highlight bg-primary/10' : ''}`}
      {...(beadIds.length > 0 ? { 'data-commit-beads': beadIds.join(' ') } : {})}
    >
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
              <p className="text-sm leading-tight break-words cursor-help">{renderMessage(commit.message, onBeadClick)}</p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm whitespace-pre-wrap text-xs">
              <p className="font-semibold mb-1">{commit.message}</p>
              <p>{commit.body}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <p className="text-sm leading-tight break-words">{renderMessage(commit.message, onBeadClick)}</p>
      )}
      <span className="text-xs text-muted-foreground">{commit.author}</span>
    </div>
  )
}
