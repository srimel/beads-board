import { Badge } from '@/components/ui/badge'
import type { GitCommit } from '@/lib/types'

const BEAD_ID_REGEX = /\b([\w]+-[a-z0-9]{4,8})\b/g

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

function renderMessage(message: string) {
  const parts = message.split(BEAD_ID_REGEX)
  return parts.map((part, i) => {
    if (BEAD_ID_REGEX.test(part)) {
      BEAD_ID_REGEX.lastIndex = 0
      return <Badge key={i} variant="outline" className="mx-0.5 text-xs">{part}</Badge>
    }
    return <span key={i}>{part}</span>
  })
}

export function CommitEntry({ commit }: { commit: GitCommit }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 px-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <code className="text-xs text-muted-foreground shrink-0">{commit.hash}</code>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {formatRelativeTime(commit.date)}
        </span>
      </div>
      <p className="text-sm leading-tight">{renderMessage(commit.message)}</p>
      <span className="text-xs text-muted-foreground">{commit.author}</span>
    </div>
  )
}
