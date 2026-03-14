import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useGitFileDiff } from '@/hooks/useBeadsApi'
import { ArrowLeft } from 'lucide-react'

interface FileDiffViewProps {
  file: string
  onBack: () => void
  branch?: string
}

function parseDiffLines(diff: string) {
  const lines = diff.split('\n')
  const result: { type: 'header' | 'hunk' | 'add' | 'remove' | 'context' | 'empty'; content: string; lineNum?: string }[] = []

  for (const line of lines) {
    if (line.startsWith('@@')) {
      result.push({ type: 'hunk', content: line })
    } else if (line.startsWith('---') || line.startsWith('+++')) {
      result.push({ type: 'header', content: line })
    } else if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.substring(1) })
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.substring(1) })
    } else if (line === '') {
      result.push({ type: 'empty', content: '' })
    } else {
      result.push({ type: 'context', content: line.startsWith(' ') ? line.substring(1) : line })
    }
  }

  return result
}

const LINE_STYLES = {
  header: 'bg-muted/50 text-muted-foreground font-bold',
  hunk: 'bg-blue-500/10 text-blue-400',
  add: 'bg-green-500/15 text-green-300',
  remove: 'bg-red-500/15 text-red-300',
  context: 'text-foreground/80',
  empty: 'text-foreground/80',
}

const LINE_PREFIX = {
  header: '',
  hunk: '',
  add: '+',
  remove: '-',
  context: ' ',
  empty: ' ',
}

export function FileDiffView({ file, onBack, branch }: FileDiffViewProps) {
  const { data, loading } = useGitFileDiff(file, branch)
  const lines = data?.diff ? parseDiffLines(data.diff) : []

  const fileName = file.split('/').pop() || file

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Back to file list"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-mono text-foreground truncate" title={file}>
          {fileName}
        </span>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {loading && !data ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 mx-3 mb-1 rounded" />
          ))
        ) : lines.length > 0 ? (
          <div className="text-xs font-mono leading-5">
            {lines.map((line, i) => (
              <div key={i} className={`px-3 ${LINE_STYLES[line.type]}`}>
                <span className="inline-block w-4 text-muted-foreground/50 select-none mr-2 text-right">
                  {LINE_PREFIX[line.type]}
                </span>
                <span className="whitespace-pre-wrap break-all">{line.type === 'hunk' ? line.content : line.content}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No diff available</p>
        )}
      </ScrollArea>
    </div>
  )
}
