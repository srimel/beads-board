import { useEffect, useState, useRef, useCallback } from 'react'
import { KanbanBoard } from '@/components/KanbanBoard'
import { GitLog } from '@/components/GitLog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { IssueDetailPanel } from '@/components/IssueDetailPanel'
import { DependencyGraph } from '@/components/DependencyGraph'
import { FilterBar, applyFilters } from '@/components/FilterBar'
import type { Filters } from '@/components/FilterBar'
import { useIssues, useReady, useBlocked, useProject } from '@/hooks/useBeadsApi'
import { TerminalPanel } from '@/components/TerminalPanel'
import type { TerminalPanelHandle } from '@/components/TerminalPanel'
import { FileExplorer } from '@/components/FileExplorer'
import { PanelRightOpen, FolderTree, Network, TerminalSquare, X, Trash2, Settings } from 'lucide-react'
import { SettingsModal } from '@/components/SettingsModal'

export interface CardSourceRect {
  top: number
  left: number
  width: number
  height: number
}

const COLLAPSED_WIDTH_PX = 40

function App() {
  const { data: issues, loading: issuesLoading, lastUpdated, error: issuesError } = useIssues()
  const { data: ready, loading: readyLoading } = useReady()
  const { data: blocked, loading: blockedLoading } = useBlocked()
  const { data: project } = useProject()

  const projectName = project?.name || 'beads-board'
  const loading = issuesLoading || readyLoading || blockedLoading
  const apiError = !loading && issuesError ? issuesError : null
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [cardSourceRect, setCardSourceRect] = useState<CardSourceRect | null>(null)
  const [showDag, setShowDag] = useState(false)
  const [filters, setFilters] = useState<Filters>({ priority: 'all', type: 'all', assignee: 'all', search: '' })
  const [highlightedBeadId, setHighlightedBeadId] = useState<string | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const terminalPanelRef = useRef<TerminalPanelHandle>(null)
  const [terminalOpen, setTerminalOpen] = useState(() => {
    return localStorage.getItem('beads-board-terminal-open') === 'true'
  })
  const [terminalHeight, setTerminalHeight] = useState(() => {
    const saved = localStorage.getItem('beads-board-terminal-height')
    return saved ? Number(saved) : 300
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fileExplorerOpen, setFileExplorerOpen] = useState(() => {
    return localStorage.getItem('beads-board-explorer-open') === 'true'
  })
  const [fileExplorerWidth, setFileExplorerWidth] = useState(() => {
    const saved = localStorage.getItem('beads-board-explorer-width')
    return saved ? Number(saved) : 240
  })
  const [searchInput, setSearchInput] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filteredIssues = applyFilters(issues || [], filters)
  const filteredReady = applyFilters(ready || [], filters)
  const filteredBlocked = applyFilters(blocked || [], filters)

  const handleIssueClick = useCallback((id: string, rect?: CardSourceRect) => {
    setCardSourceRect(rect || null)
    setSelectedIssueId(id)
    // Highlight related commits in git log
    setHighlightedBeadId(id)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => setHighlightedBeadId(null), 4000)
    // Scroll to first matching commit in git log
    requestAnimationFrame(() => {
      const firstCommit = document.querySelector(`[data-commit-beads~="${id}"]`) as HTMLElement | null
      if (firstCommit) {
        firstCommit.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }, [])

  const handleBeadClick = useCallback((beadId: string) => {
    // Clear any commit highlight when navigating from git log to kanban
    setHighlightedBeadId(null)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    // Scroll to and highlight the matching card on the kanban board
    const card = document.querySelector(`[data-bead-id="${beadId}"]`) as HTMLElement | null
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      card.classList.remove('animate-bead-highlight')
      // Force reflow so re-adding the class restarts the animation
      void card.offsetWidth
      card.classList.add('animate-bead-highlight')
      setTimeout(() => card.classList.remove('animate-bead-highlight'), 1200)
    }
    setCardSourceRect(null)
    setSelectedIssueId(beadId)
  }, [])

  const mainRef = useRef<HTMLDivElement>(null)
  const [splitPercent, setSplitPercent] = useState(() => {
    const saved = localStorage.getItem('beads-board-split')
    return saved ? Number(saved) : 65
  })
  const [gitLogCollapsed, setGitLogCollapsed] = useState(() => {
    return localStorage.getItem('beads-board-git-collapsed') === 'true'
  })
  const kanbanRef = useRef<HTMLDivElement>(null)
  const gitLogRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  const toggleGitLogCollapsed = useCallback(() => {
    setGitLogCollapsed(prev => {
      const next = !prev
      localStorage.setItem('beads-board-git-collapsed', String(next))
      return next
    })
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const main = mainRef.current
    const kanban = kanbanRef.current
    const gitLog = gitLogRef.current
    if (!main || !kanban || !gitLog) return

    // Auto-expand if collapsed when user starts dragging
    if (gitLogCollapsed) {
      setGitLogCollapsed(false)
      localStorage.setItem('beads-board-git-collapsed', 'false')
    }

    // Remove transitions during drag
    kanban.style.transition = 'none'
    gitLog.style.transition = 'none'

    const onMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const rect = main.getBoundingClientRect()
        const pct = ((e.clientX - rect.left) / rect.width) * 100
        const clamped = Math.min(85, Math.max(30, pct))
        // Direct DOM update — no React re-render during drag
        kanban.style.width = `${clamped}%`
        gitLog.style.width = `${100 - clamped}%`
        splitPercentRef.current = clamped
      })
    }

    const onMouseUp = () => {
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      // Restore transitions
      kanban.style.transition = ''
      gitLog.style.transition = ''
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      // Sync React state and persist
      const final = splitPercentRef.current
      setSplitPercent(final)
      localStorage.setItem('beads-board-split', String(final))
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [gitLogCollapsed])

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value }))
    }, 200)
  }, [])

  const toggleFileExplorer = useCallback(() => {
    setFileExplorerOpen(prev => {
      const next = !prev
      localStorage.setItem('beads-board-explorer-open', String(next))
      return next
    })
  }, [])

  const handleSettingsSave = useCallback((settings: { fontFamily: string }) => {
    terminalPanelRef.current?.setFontFamily(settings.fontFamily)
  }, [])

  const splitPercentRef = useRef(splitPercent)
  splitPercentRef.current = splitPercent

  useEffect(() => {
    document.title = projectName
  }, [projectName])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setTerminalOpen(prev => {
          const next = !prev
          localStorage.setItem('beads-board-terminal-open', String(next))
          return next
        })
      }
      if (e.key === ',' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSettingsOpen(prev => !prev)
      }
      if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setFileExplorerOpen(prev => {
          const next = !prev
          localStorage.setItem('beads-board-explorer-open', String(next))
          return next
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
          <button
            onClick={toggleFileExplorer}
            className={`rounded-md p-2 transition-colors ${
              fileExplorerOpen
                ? 'bg-primary/15 text-primary hover:bg-primary/25'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            title={fileExplorerOpen ? 'Hide explorer (Ctrl+B)' : 'Show explorer (Ctrl+B)'}
          >
            <FolderTree className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowDag(prev => !prev)}
            className={`rounded-md p-2 transition-colors ${
              showDag
                ? 'bg-primary/15 text-primary hover:bg-primary/25'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            title={showDag ? 'Show kanban board' : 'Show dependency graph'}
          >
            <Network className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTerminalOpen(prev => {
              const next = !prev
              localStorage.setItem('beads-board-terminal-open', String(next))
              return next
            })}
            className={`rounded-md p-2 transition-colors ${
              terminalOpen
                ? 'bg-primary/15 text-primary hover:bg-primary/25'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            title={terminalOpen ? 'Hide terminal (Ctrl+`)' : 'Show terminal (Ctrl+`)'}
          >
            <TerminalSquare className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className={`rounded-md p-2 transition-colors ${
              settingsOpen
                ? 'bg-primary/15 text-primary hover:bg-primary/25'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            title="Settings (Ctrl+,)"
          >
            <Settings className="h-4 w-4" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Error banner */}
      {apiError && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm border-b border-destructive/20">
          {apiError} — showing last known data
        </div>
      )}

      {/* Filter bar */}
      {!showDag && (
        <FilterBar filters={filters} onFiltersChange={(f) => { setFilters(f); setSearchInput(f.search) }} issues={issues || []} searchInput={searchInput} onSearchChange={handleSearchChange} />
      )}

      {/* Main content */}
      {showDag ? (
        <main className="flex-1 min-h-0">
          <DependencyGraph
            issues={issues || []}
            onNodeClick={(id) => {
              setCardSourceRect(null)
              setSelectedIssueId(id)
            }}
          />
        </main>
      ) : (
        <main className="flex flex-1 min-h-0">
          {/* File Explorer */}
          {fileExplorerOpen && (
            <>
              <div
                style={{ width: `${fileExplorerWidth}px` }}
                className="shrink-0 overflow-hidden transition-[width] duration-200"
              >
                <FileExplorer onCollapse={toggleFileExplorer} />
              </div>
              {/* Explorer resize handle */}
              <div
                className="w-1 cursor-col-resize hover:bg-border active:bg-primary/50 shrink-0 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault()
                  const startX = e.clientX
                  const startWidth = fileExplorerWidth

                  const onMouseMove = (e: MouseEvent) => {
                    const delta = e.clientX - startX
                    const newWidth = Math.max(150, Math.min(startWidth + delta, 500))
                    setFileExplorerWidth(newWidth)
                  }

                  const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove)
                    document.removeEventListener('mouseup', onMouseUp)
                    document.body.style.cursor = ''
                    document.body.style.userSelect = ''
                    localStorage.setItem('beads-board-explorer-width', String(fileExplorerWidth))
                  }

                  document.body.style.cursor = 'col-resize'
                  document.body.style.userSelect = 'none'
                  document.addEventListener('mousemove', onMouseMove)
                  document.addEventListener('mouseup', onMouseUp)
                }}
              />
            </>
          )}

          {/* Kanban + Git Log wrapper — fills remaining space */}
          <div ref={mainRef} className="flex flex-1 min-w-0">
          {/* Kanban + Terminal */}
          <div
            ref={kanbanRef}
            style={gitLogCollapsed
              ? { width: `calc(100% - ${COLLAPSED_WIDTH_PX}px - 4px)` }
              : { width: `${splitPercent}%` }
            }
            className="flex flex-col overflow-hidden transition-[width] duration-200"
          >
            {/* Kanban board — takes remaining space */}
            <div className="flex-1 min-h-0 pl-3 pt-3 pb-3 pr-0 overflow-hidden">
              <KanbanBoard
                issues={filteredIssues}
                allIssues={issues || []}
                ready={filteredReady}
                blocked={filteredBlocked}
                loading={loading}
                onIssueClick={handleIssueClick}
              />
            </div>

            {/* Terminal resize edge + panel — always mounted to preserve session */}
            {terminalOpen && (
              <div
                className="h-1 cursor-row-resize hover:bg-border active:bg-primary/50 shrink-0 transition-colors border-t border-border"
                onMouseDown={(e) => {
                  e.preventDefault()
                  const startY = e.clientY
                  const startHeight = terminalHeight

                  const onMouseMove = (e: MouseEvent) => {
                    const delta = startY - e.clientY
                    const newHeight = Math.max(100, Math.min(startHeight + delta, window.innerHeight * 0.7))
                    setTerminalHeight(newHeight)
                    localStorage.setItem('beads-board-terminal-height', String(newHeight))
                  }

                  const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove)
                    document.removeEventListener('mouseup', onMouseUp)
                    document.body.style.cursor = ''
                    document.body.style.userSelect = ''
                  }

                  document.body.style.cursor = 'row-resize'
                  document.body.style.userSelect = 'none'
                  document.addEventListener('mousemove', onMouseMove)
                  document.addEventListener('mouseup', onMouseUp)
                }}
              />
            )}
            <div style={{ height: terminalOpen ? `${terminalHeight}px` : '0px' }} className="shrink-0 overflow-hidden flex flex-col">
              {terminalOpen && (
                <div className="flex items-center justify-end gap-1 px-2 py-0.5 bg-[#0d1117] border-b border-border/30 shrink-0">
                  <button
                    onClick={() => terminalPanelRef.current?.resetSession()}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Clear session"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setTerminalOpen(false)
                      localStorage.setItem('beads-board-terminal-open', 'false')
                    }}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Hide terminal (Ctrl+`)"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <TerminalPanel ref={terminalPanelRef} visible={terminalOpen} />
            </div>
          </div>

          {/* Draggable splitter */}
          <div
            className="w-1 cursor-col-resize hover:bg-border active:bg-primary/50 shrink-0 transition-colors"
            onMouseDown={handleMouseDown}
          />

          {/* Git Log */}
          {gitLogCollapsed ? (
            <div
              style={{ width: `${COLLAPSED_WIDTH_PX}px` }}
              className="flex flex-col items-center border-l border-border shrink-0 transition-[width] duration-200"
            >
              <button
                onClick={toggleGitLogCollapsed}
                className="mt-3 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Expand git log"
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div ref={gitLogRef} style={{ width: `${100 - splitPercent}%` }} className="overflow-hidden transition-[width] duration-200">
              <GitLog onCollapse={toggleGitLogCollapsed} onBeadClick={handleBeadClick} highlightedBeadId={highlightedBeadId} />
            </div>
          )}
          </div>{/* end kanban+git wrapper */}
        </main>
      )}
      <IssueDetailPanel
        issueId={selectedIssueId}
        open={selectedIssueId !== null}
        onClose={() => setSelectedIssueId(null)}
        sourceRect={cardSourceRect}
        issues={issues ?? undefined}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSettingsSave}
      />
    </div>
  )
}

export default App
