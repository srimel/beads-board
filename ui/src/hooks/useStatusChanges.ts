import { useRef, useState, useEffect, useCallback } from 'react'
import type { BeadIssue } from '@/lib/types'

export interface StatusChange {
  issueId: string
  title: string
  oldStatus: string | null
  newStatus: string | null
  timestamp: Date
}

/**
 * Detects status changes between polling updates of issue data.
 * Compares current issues against the previous poll to find additions,
 * removals, and status changes. Changes auto-clear after the configured timeout.
 *
 * @param issues - Current array of issues from polling (null if not yet loaded)
 * @param clearAfterMs - How long to keep changes before auto-clearing (default 5000ms)
 * @returns Array of detected status changes
 */
export function useStatusChanges(
  issues: BeadIssue[] | null,
  clearAfterMs: number = 5000
): StatusChange[] {
  const prevIssuesRef = useRef<Map<string, BeadIssue> | null>(null)
  const [changes, setChanges] = useState<StatusChange[]>([])
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const detectChanges = useCallback(
    (current: BeadIssue[]) => {
      const prev = prevIssuesRef.current
      // Skip detection on the very first poll (no previous data to compare)
      if (prev === null) return

      const now = new Date()
      const detected: StatusChange[] = []
      const currentMap = new Map(current.map((issue) => [issue.id, issue]))

      // Check for status changes and new issues
      for (const issue of current) {
        const prevIssue = prev.get(issue.id)
        if (!prevIssue) {
          // New issue added
          detected.push({
            issueId: issue.id,
            title: issue.title,
            oldStatus: null,
            newStatus: issue.status,
            timestamp: now,
          })
        } else if (prevIssue.status !== issue.status) {
          // Status changed
          detected.push({
            issueId: issue.id,
            title: issue.title,
            oldStatus: prevIssue.status,
            newStatus: issue.status,
            timestamp: now,
          })
        }
      }

      // Check for removed issues
      for (const [id, prevIssue] of prev) {
        if (!currentMap.has(id)) {
          detected.push({
            issueId: id,
            title: prevIssue.title,
            oldStatus: prevIssue.status,
            newStatus: null,
            timestamp: now,
          })
        }
      }

      if (detected.length > 0) {
        setChanges((existing) => [...existing, ...detected])
      }
    },
    []
  )

  // Run detection whenever issues update
  useEffect(() => {
    if (issues === null) return

    detectChanges(issues)
    // Update the ref for next comparison
    prevIssuesRef.current = new Map(issues.map((issue) => [issue.id, issue]))
  }, [issues, detectChanges])

  // Auto-clear changes after timeout
  useEffect(() => {
    if (changes.length === 0) return

    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current)
    }

    clearTimerRef.current = setTimeout(() => {
      setChanges([])
      clearTimerRef.current = null
    }, clearAfterMs)

    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current)
      }
    }
  }, [changes, clearAfterMs])

  return changes
}
