import { useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  File,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  Folder,
  FolderOpen,
  Hash,
  Terminal,
  Palette,
  Globe,
  Cog,
  Package,
  GitBranch,
  BookOpen,
} from 'lucide-react'
import { getFileIconType } from '@/lib/fileIcons'
import type { FileEntry } from '@/lib/types'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  typescript: FileCode,
  javascript: FileCode,
  json: FileJson,
  npm: Package,
  html: Globe,
  css: Palette,
  image: FileImage,
  markdown: FileText,
  readme: BookOpen,
  text: FileText,
  config: Cog,
  shell: Terminal,
  git: GitBranch,
  yaml: FileJson,
  xml: FileJson,
  data: Hash,
  python: FileCode,
  go: FileCode,
  rust: FileCode,
  java: FileCode,
  c: FileCode,
  cpp: FileCode,
  docker: Package,
  eslint: Cog,
  vite: Cog,
  tailwind: Palette,
  license: FileText,
  document: FileText,
  file: File,
}

const ICON_COLOR_MAP: Record<string, string> = {
  typescript: 'text-blue-400',
  javascript: 'text-yellow-400',
  json: 'text-yellow-600',
  npm: 'text-red-400',
  html: 'text-orange-400',
  css: 'text-blue-300',
  image: 'text-green-400',
  markdown: 'text-gray-400',
  readme: 'text-blue-300',
  config: 'text-gray-500',
  shell: 'text-green-500',
  git: 'text-orange-500',
  yaml: 'text-purple-400',
  python: 'text-yellow-500',
  vite: 'text-purple-400',
  tailwind: 'text-cyan-400',
}

interface FileTreeItemProps {
  entry: FileEntry
  depth: number
  onDirectoryToggle: (path: string) => void
  onFileClick?: (filePath: string) => void
  expandedDirs: Set<string>
  dirCache: Record<string, FileEntry[]>
  loadingDirs: Set<string>
}

export function FileTreeItem({
  entry,
  depth,
  onDirectoryToggle,
  onFileClick,
  expandedDirs,
  dirCache,
  loadingDirs,
}: FileTreeItemProps) {
  const isDir = entry.type === 'directory'
  const isExpanded = expandedDirs.has(entry.path)
  const isLoading = loadingDirs.has(entry.path)

  const handleClick = useCallback(() => {
    if (isDir) {
      onDirectoryToggle(entry.path)
    } else {
      onFileClick?.(entry.path)
    }
  }, [isDir, entry.path, onDirectoryToggle, onFileClick])

  const iconType = isDir ? null : getFileIconType(entry.name)
  const FileIcon = iconType ? (ICON_MAP[iconType] || File) : null
  const iconColor = iconType ? (ICON_COLOR_MAP[iconType] || 'text-muted-foreground') : ''

  const childEntries = isDir ? dirCache[entry.path] : undefined

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center w-full px-1 py-0.5 text-sm hover:bg-accent/50 rounded-sm transition-colors group text-left"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {/* Chevron for directories */}
        {isDir ? (
          <span className="w-4 h-4 flex items-center justify-center shrink-0 mr-0.5">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </span>
        ) : (
          <span className="w-4 h-4 shrink-0 mr-0.5" />
        )}

        {/* Icon */}
        {isDir ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 text-yellow-500 shrink-0 mr-1.5" />
          ) : (
            <Folder className="h-4 w-4 text-yellow-600 shrink-0 mr-1.5" />
          )
        ) : (
          FileIcon && <FileIcon className={`h-4 w-4 shrink-0 mr-1.5 ${iconColor}`} />
        )}

        {/* Name */}
        <span className="truncate text-foreground/90">{entry.name}</span>
      </button>

      {/* Children */}
      {isDir && isExpanded && (
        <>
          {isLoading ? (
            <div
              className="flex items-center text-xs text-muted-foreground animate-pulse"
              style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
            >
              Loading...
            </div>
          ) : childEntries && childEntries.length === 0 ? (
            <div
              className="text-xs text-muted-foreground italic"
              style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
            >
              (empty)
            </div>
          ) : (
            childEntries?.map((child) => (
              <FileTreeItem
                key={child.path}
                entry={child}
                depth={depth + 1}
                onDirectoryToggle={onDirectoryToggle}
                onFileClick={onFileClick}
                expandedDirs={expandedDirs}
                dirCache={dirCache}
                loadingDirs={loadingDirs}
              />
            ))
          )}
        </>
      )}
    </>
  )
}
