import { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTreeItem } from './FileTreeItem'
import type { FileEntry } from '@/lib/types'

export interface FileExplorerHandle {
  refresh: () => void
}

async function fetchFiles(dirPath: string, branch?: string): Promise<FileEntry[]> {
  const url = `/api/files?path=${encodeURIComponent(dirPath)}${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

interface FileExplorerProps {
  onFileClick?: (filePath: string) => void
  branch?: string
}

export const FileExplorer = forwardRef<FileExplorerHandle, FileExplorerProps>(function FileExplorer({ onFileClick, branch }, ref) {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([])
  const [dirCache, setDirCache] = useState<Record<string, FileEntry[]>>({})
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Load root entries on mount and when branch changes
  useEffect(() => {
    setDirCache({})
    setExpandedDirs(new Set())
    fetchFiles('', branch).then((entries) => {
      setRootEntries(entries)
      setError(null)
    }).catch((err) => {
      setError(err.message)
    })
  }, [branch])

  const handleRefresh = useCallback(() => {
    setDirCache({})
    setExpandedDirs(new Set())
    fetchFiles('', branch).then((entries) => {
      setRootEntries(entries)
      setError(null)
    }).catch((err) => {
      setError(err.message)
    })
  }, [branch])

  useImperativeHandle(ref, () => ({ refresh: handleRefresh }), [handleRefresh])

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
          fetchFiles(dirPath, branch).then((entries) => {
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
  }, [dirCache, branch])

  // Render root entries — FileTreeItem handles recursion via dirCache
  const renderEntries = useCallback(
    (entries: FileEntry[]): React.ReactNode => {
      return entries.map((entry) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          depth={0}
          onDirectoryToggle={handleDirectoryToggle}
          onFileClick={onFileClick}
          expandedDirs={expandedDirs}
          dirCache={dirCache}
          loadingDirs={loadingDirs}
        />
      ))
    },
    [dirCache, expandedDirs, loadingDirs, handleDirectoryToggle, onFileClick]
  )

  return (
    <ScrollArea className="h-full">
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
  )
})
