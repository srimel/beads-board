import { useState, useMemo } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Clock, Signal } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BeadCard } from './BeadCard'
import type { BeadIssue } from '@/lib/types'
import type { CardSourceRect } from '@/App'

type SortField = 'recent' | 'priority'
type SortDirection = 'asc' | 'desc'

interface KanbanColumnProps {
  title: string
  issues: BeadIssue[]
  accentColor: string
  loading?: boolean
  sortable?: boolean
  onIssueClick?: (id: string, rect?: CardSourceRect) => void
}

function sortIssues(issues: BeadIssue[], field: SortField, direction: SortDirection): BeadIssue[] {
  const dir = direction === 'desc' ? 1 : -1
  return [...issues].sort((a, b) => {
    if (field === 'priority') {
      const pDiff = (a.priority ?? 4) - (b.priority ?? 4)
      if (pDiff !== 0) return direction === 'asc' ? pDiff : -pDiff
      // tie-break by updated_at desc
      return dir * (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
    }
    // recent: sort by updated_at
    return dir * (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
  })
}

const fieldLabels: Record<SortField, string> = {
  recent: 'Closed date',
  priority: 'Priority',
}

const fieldIcons: Record<SortField, typeof Clock> = {
  recent: Clock,
  priority: Signal,
}

export function KanbanColumn({ title, issues, accentColor, loading, sortable, onIssueClick }: KanbanColumnProps) {
  const [sortField, setSortField] = useState<SortField>('recent')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const sortedIssues = useMemo(
    () => sortable ? sortIssues(issues, sortField, sortDirection) : issues,
    [issues, sortField, sortDirection, sortable]
  )

  const toggleDirection = () => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')

  const ArrowIcon = sortDirection === 'desc' ? ArrowDown : ArrowUp
  const FieldIcon = fieldIcons[sortField]

  return (
    <div className="min-w-0 flex-1">
      <div className={`flex items-center gap-2 px-3 py-2 border-b-2 sticky top-0 z-10 bg-background ${accentColor}`}>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">({issues.length})</span>
        {sortable && (
          <div className="ml-auto flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-muted"
                  title={`Sort by ${fieldLabels[sortField]}`}
                >
                  <FieldIcon className="h-3 w-3" />
                  <span>{fieldLabels[sortField]}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                {(Object.keys(fieldLabels) as SortField[]).map((field) => {
                  const Icon = fieldIcons[field]
                  return (
                    <DropdownMenuItem
                      key={field}
                      onClick={() => setSortField(field)}
                      className={sortField === field ? 'bg-muted' : ''}
                    >
                      <Icon className="h-3.5 w-3.5 mr-2" />
                      {fieldLabels[field]}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={toggleDirection}
              title={sortDirection === 'desc' ? 'Descending — click for ascending' : 'Ascending — click for descending'}
              className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors rounded p-0.5 hover:bg-muted"
            >
              <ArrowIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="p-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 mb-2 rounded-lg" />
          ))
        ) : sortedIssues.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No issues</p>
        ) : (
          sortedIssues.map(issue => <BeadCard key={issue.id} issue={issue} onClick={onIssueClick} />)
        )}
      </div>
    </div>
  )
}
