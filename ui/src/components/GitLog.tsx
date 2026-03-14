import { useState, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BranchSelector } from './BranchSelector'
import { CommitEntry } from './CommitEntry'
import { FileDiffView } from './FileDiffView'
import { FileContentView } from './FileContentView'
import { FileExplorer } from './FileExplorer'
import type { FileExplorerHandle } from './FileExplorer'
import { useGitLog, useBranches, useGitStatus } from '@/hooks/useBeadsApi'
import { PanelRightClose, GitCommitHorizontal, FileDiff, FolderTree, RefreshCw } from 'lucide-react'

interface GitLogProps {
  onCollapse?: () => void
  onBeadClick?: (beadId: string) => void
  highlightedBeadId?: string | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  'M': { label: 'Modified', color: 'text-yellow-400' },
  'A': { label: 'Added', color: 'text-green-400' },
  'D': { label: 'Deleted', color: 'text-red-400' },
  'R': { label: 'Renamed', color: 'text-blue-400' },
  'C': { label: 'Copied', color: 'text-blue-400' },
  '??': { label: 'Untracked', color: 'text-muted-foreground' },
  'MM': { label: 'Modified', color: 'text-yellow-400' },
  'AM': { label: 'Added', color: 'text-green-400' },
}

function statusInfo(status: string) {
  return STATUS_LABELS[status] || { label: status, color: 'text-muted-foreground' }
}

export function GitLog({ onCollapse, onBeadClick, highlightedBeadId }: GitLogProps) {
  const { data: branchData, loading: branchesLoading } = useBranches()
  const [selectedBranch, setSelectedBranch] = useState('')
  const [activeTab, setActiveTab] = useState(() =>
    localStorage.getItem('beads-board-git-tab') || 'log'
  )
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [viewingFile, setViewingFile] = useState<string | null>(null)

  const fileExplorerRef = useRef<FileExplorerHandle>(null)
  const branch = selectedBranch || branchData?.current || ''
  const { data: commits, loading: commitsLoading } = useGitLog(branch)
  const { data: statusFiles, loading: statusLoading } = useGitStatus(branch)

  const hasOverlay = !!(viewingFile || selectedFile)

  return (
    <div className="flex flex-col h-full border-l border-border">
      {/* Overlay views — rendered on top, hiding the tabs beneath */}
      {viewingFile ? (
        <FileContentView file={viewingFile} onBack={() => setViewingFile(null)} branch={branch} />
      ) : selectedFile ? (
        <FileDiffView file={selectedFile} onBack={() => setSelectedFile(null)} branch={branch} />
      ) : null}

      {/* Main tab structure — always mounted to preserve FileExplorer state, hidden when overlay is active */}
      <div className={`flex flex-col flex-1 min-h-0 ${hasOverlay ? 'hidden' : ''}`}>
        <div className="p-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Git</h2>
            {onCollapse && (
              <button
                onClick={onCollapse}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Collapse git log"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            )}
          </div>
          {branchesLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : branchData ? (
            <BranchSelector
              branches={branchData.branches}
              current={branch}
              onSelect={setSelectedBranch}
            />
          ) : null}
        </div>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); localStorage.setItem('beads-board-git-tab', v) }} className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mx-3 mt-2 shrink-0">
            <TabsList>
              <TabsTrigger value="files" className="gap-1.5">
                <FolderTree className="h-3.5 w-3.5" />
                Files
              </TabsTrigger>
              <TabsTrigger value="log" className="gap-1.5">
                <GitCommitHorizontal className="h-3.5 w-3.5" />
                Log
              </TabsTrigger>
              <TabsTrigger value="diff" className="gap-1.5">
                <FileDiff className="h-3.5 w-3.5" />
                Diff
                {statusFiles && statusFiles.length > 0 && (
                  <span className="ml-1 text-xs bg-primary/20 text-primary rounded-full px-1.5">
                    {statusFiles.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            {activeTab === 'files' && (
              <button
                onClick={() => fileExplorerRef.current?.refresh()}
                className="rounded-md p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh files"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <TabsContent value="files" className="flex-1 min-h-0 mt-0">
            <FileExplorer ref={fileExplorerRef} onFileClick={setViewingFile} branch={branch} />
          </TabsContent>
          <TabsContent value="log" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              {commitsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 mx-3 mb-2 rounded" />
                ))
              ) : commits?.length ? (
                commits.map(commit => <CommitEntry key={commit.hash} commit={commit} onBeadClick={onBeadClick} highlightedBeadId={highlightedBeadId} />)
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No commits</p>
              )}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="diff" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              {statusLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 mx-3 mb-2 rounded" />
                ))
              ) : statusFiles?.length ? (
                <div className="px-3 py-2 space-y-1">
                  {statusFiles.map((file, i) => {
                    const info = statusInfo(file.status)
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/50 text-xs font-mono cursor-pointer"
                        onClick={() => setSelectedFile(file.path)}
                      >
                        <span className="text-foreground truncate flex-1" title={file.path}>
                          {file.path}
                        </span>
                        <span className={`shrink-0 w-20 text-right ${info.color}`}>
                          {info.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">Working tree clean</p>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
