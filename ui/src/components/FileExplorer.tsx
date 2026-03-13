import { useState, useCallback, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTreeItem } from './FileTreeItem'
import { PanelLeftClose, FolderTree, RefreshCw } from 'lucide-react'
import type { FileEntry } from '@/lib/types'

interface FileExplorerProps {
  onCollapse: () => void
}

async function fetchFiles(dirPath: string): Promise<FileEntry[]> {
  const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export function FileExplorer({ onCollapse }: FileExplorerProps) {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([])
  const [dirCache, setDirCache] = useState<Record<string, FileEntry[]>>({})
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Load root entries on mount
  useEffect(() => {
    fetchFiles('').then((entries) => {
      setRootEntries(entries)
      setError(null)
    }).catch((err) => {
      setError(err.message)
    })
  }, [])

  const handleRefresh = useCallback(() => {
    setDirCache({})
    setExpandedDirs(new Set())
    fetchFiles('').then((entries) => {
      setRootEntries(entries)
      setError(null)
    }).catch((err) => {
      setError(err.message)
    })
  }, [])

  const handleDirectoryToggle = useCallback((dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
        // Fetch children if not already cached
        if (!dirCache[dirPath]) {
          setLoadingDirs((ld) => new Set(ld).add(dirPath))
          fetchFiles(dirPath).then((entries) => {
            setDirCache((c) => ({ ...c, [dirPath]: entries }))
            setLoadingDirs((ld) => {
              const newLd = new Set(ld)
              newLd.delete(dirPath)
              return newLd
            })
          }).catch(() => {
            setLoadingDirs((ld) => {
              const newLd = new Set(ld)
              newLd.delete(dirPath)
              return newLd
            })
          })
        }
      }
      return next
    })
  }, [dirCache])

  // Render root entries — FileTreeItem handles recursion via dirCache
  const renderEntries = useCallback(
    (entries: FileEntry[]): React.ReactNode => {
      return entries.map((entry) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          depth={0}
          onDirectoryToggle={handleDirectoryToggle}
          expandedDirs={expandedDirs}
          dirCache={dirCache}
          loadingDirs={loadingDirs}
        />
      ))
    },
    [dirCache, expandedDirs, loadingDirs, handleDirectoryToggle]
  )

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Explorer
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleRefresh}
            className="rounded-md p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onCollapse}
            className="rounded-md p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Collapse explorer"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {error ? (
            <div className="px-3 py-2 text-xs text-destructive">{error}</div>
          ) : rootEntries.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground animate-pulse">Loading...</div>
          ) : (
            renderEntries(rootEntries)
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
