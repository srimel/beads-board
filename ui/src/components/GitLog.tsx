import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { BranchSelector } from './BranchSelector'
import { CommitEntry } from './CommitEntry'
import { useGitLog, useBranches } from '@/hooks/useBeadsApi'

export function GitLog() {
  const { data: branchData, loading: branchesLoading } = useBranches()
  const [selectedBranch, setSelectedBranch] = useState('')

  const branch = selectedBranch || branchData?.current || ''
  const { data: commits, loading: commitsLoading } = useGitLog(branch)

  return (
    <div className="flex flex-col h-full border-l border-border">
      <div className="p-3 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold mb-2">Git Log</h2>
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
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        {commitsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 mx-3 mb-2 rounded" />
          ))
        ) : commits?.length ? (
          commits.map(commit => <CommitEntry key={commit.hash} commit={commit} />)
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No commits</p>
        )}
      </ScrollArea>
    </div>
  )
}
