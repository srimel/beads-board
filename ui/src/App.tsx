import { useEffect, useState, useRef, useCallback } from 'react'
import { KanbanBoard } from '@/components/KanbanBoard'
import { GitLog } from '@/components/GitLog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { IssueDetailPanel } from '@/components/IssueDetailPanel'
import { useIssues, useReady, useBlocked, useProject } from '@/hooks/useBeadsApi'

function App() {
  const { data: issues, loading: issuesLoading, lastUpdated, error: issuesError } = useIssues()
  const { data: ready, loading: readyLoading } = useReady()
  const { data: blocked, loading: blockedLoading } = useBlocked()
  const { data: project } = useProject()

  const projectName = project?.name || 'beads-board'
  const loading = issuesLoading || readyLoading || blockedLoading
  const apiError = !loading && issuesError ? issuesError : null
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)

  const mainRef = useRef<HTMLDivElement>(null)
  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = localStorage.getItem('beads-board-split')
    return saved ? Number(saved) : 65
  })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const main = mainRef.current
    if (!main) return

    const onMouseMove = (e: MouseEvent) => {
      const rect = main.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      const clamped = Math.min(85, Math.max(30, pct))
      setSplitPercent(clamped)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setSplitPercent(prev => {
        localStorage.setItem('beads-board-split', String(prev))
        return prev
      })
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  useEffect(() => {
    document.title = projectName
  }, [projectName])

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <h1 className="text-lg font-bold tracking-tight">{projectName}</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {loading && (
            <span className="text-xs text-muted-foreground animate-pulse">refreshing...</span>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Error banner */}
      {apiError && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm border-b border-destructive/20">
          {apiError} — showing last known data
        </div>
      )}

      {/* Main content */}
      <main ref={mainRef} className="flex flex-1 min-h-0">
        {/* Kanban */}
        <div style={{ width: `${splitPercent}%` }} className="pl-3 pt-3 pb-3 pr-0 overflow-hidden">
          <KanbanBoard
            issues={issues || []}
            ready={ready || []}
            blocked={blocked || []}
            loading={loading}
            onIssueClick={setSelectedIssueId}
          />
        </div>

        {/* Draggable splitter */}
        <div
          className="w-1 cursor-col-resize hover:bg-border active:bg-primary/50 shrink-0 transition-colors"
          onMouseDown={handleMouseDown}
        />

        {/* Git Log */}
        <div style={{ width: `${100 - splitPercent}%` }} className="overflow-hidden">
          <GitLog />
        </div>
      </main>
      <IssueDetailPanel
        issueId={selectedIssueId}
        open={selectedIssueId !== null}
        onClose={() => setSelectedIssueId(null)}
      />
    </div>
  )
}

export default App
