import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search } from 'lucide-react'
import type { BeadIssue } from '@/lib/types'

export interface Filters {
  priority: string // "all" | "0" | "1" | "2" | "3" | "4"
  type: string     // "all" | "task" | "bug" | "feature" | "epic" | "chore"
  assignee: string // "all" | assignee name
  search: string   // free-text search on id, title, description
}

interface FilterBarProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  issues: BeadIssue[]
  searchInput: string
  onSearchChange: (value: string) => void
}

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priorities' },
  { value: '0', label: 'P0' },
  { value: '1', label: 'P1' },
  { value: '2', label: 'P2' },
  { value: '3', label: 'P3' },
  { value: '4', label: 'P4' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'epic', label: 'Epic' },
  { value: 'chore', label: 'Chore' },
]

export function FilterBar({ filters, onFiltersChange, issues, searchInput, onSearchChange }: FilterBarProps) {
  const assignees = useMemo(() => {
    const set = new Set<string>()
    for (const issue of issues) {
      if (issue.assignee) set.add(issue.assignee)
    }
    return Array.from(set).sort()
  }, [issues])

  const hasActiveFilters =
    filters.priority !== 'all' ||
    filters.type !== 'all' ||
    filters.assignee !== 'all' ||
    (filters.search?.length > 0)

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search beads..."
          className="h-8 w-48 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors"
        />
      </div>

      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filters</span>

      <Select
        value={filters.priority}
        onValueChange={(value) => onFiltersChange({ ...filters, priority: value })}
      >
        <SelectTrigger size="sm" className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.type}
        onValueChange={(value) => onFiltersChange({ ...filters, type: value })}
      >
        <SelectTrigger size="sm" className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.assignee}
        onValueChange={(value) => onFiltersChange({ ...filters, assignee: value })}
      >
        <SelectTrigger size="sm" className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Assignees</SelectItem>
          {assignees.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <button
          onClick={() => onFiltersChange({ priority: 'all', type: 'all', assignee: 'all', search: '' })}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Clear
        </button>
      )}
    </div>
  )
}

export function applyFilters(issues: BeadIssue[], filters: Filters): BeadIssue[] {
  const searchLower = filters.search?.toLowerCase().trim() || ''
  return issues.filter((issue) => {
    if (filters.priority !== 'all' && String(issue.priority) !== filters.priority) {
      return false
    }
    if (filters.type !== 'all' && issue.type !== filters.type) {
      return false
    }
    if (filters.assignee !== 'all' && issue.assignee !== filters.assignee) {
      return false
    }
    if (searchLower) {
      const haystack = `${issue.id} ${issue.title} ${issue.description || ''}`.toLowerCase()
      if (!haystack.includes(searchLower)) return false
    }
    return true
  })
}
