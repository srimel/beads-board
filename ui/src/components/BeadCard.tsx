import type { BeadIssue } from '@/lib/types'

export function BeadCard({ issue }: { issue: BeadIssue }) {
  return <div>{issue.title}</div>
}
