import { useEffect, useRef } from 'react'
import { KanbanBoard } from '@/components/KanbanBoard'
import { GitLog } from '@/components/GitLog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useIssues, useReady, useBlocked, useProject } from '@/hooks/useBeadsApi'

function playChime() {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = 800
  gain.gain.value = 0.3
  osc.start()
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
  osc.stop(ctx.currentTime + 0.5)
}

function App() {
  const { data: issues, loading: issuesLoading, lastUpdated, error: issuesError } = useIssues()
  const { data: ready, loading: readyLoading } = useReady()
  const { data: blocked, loading: blockedLoading } = useBlocked()
  const { data: project } = useProject()

  const projectName = project?.name || 'beads-board'
  const loading = issuesLoading || readyLoading || blockedLoading
  const apiError = !loading && issuesError ? issuesError : null

  // Track in_progress count to detect transition to zero
  const prevInProgressCount = useRef<number | null>(null)
  const inProgressCount = (issues || []).filter(i => i.status === 'in_progress').length

  useEffect(() => {
    if (loading) return
    // Skip initial load — only trigger on transitions after first data arrives
    if (prevInProgressCount.current !== null && prevInProgressCount.current > 0 && inProgressCount === 0) {
      playChime()
    }
    prevInProgressCount.current = inProgressCount
  }, [loading, inProgressCount])

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
      <main className="flex flex-1 min-h-0">
        {/* Kanban — 65% */}
        <div className="w-[65%] pl-3 pt-3 pb-3 pr-0 overflow-hidden">
          <KanbanBoard
            issues={issues || []}
            ready={ready || []}
            blocked={blocked || []}
            loading={loading}
          />
        </div>

        {/* Git Log — 35% */}
        <div className="w-[35%] overflow-hidden">
          <GitLog />
        </div>
      </main>
    </div>
  )
}

export default App
