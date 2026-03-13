import { useCallback } from 'react'
import { usePolling } from './usePolling'
import type { BeadIssue, GitCommit, BranchesResponse, FileEntry } from '@/lib/types'

const API_BASE = ''  // Same origin

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export function useIssues() {
  const fetchFn = useCallback(() => fetchJson<BeadIssue[]>('/api/issues'), [])
  return usePolling(fetchFn)
}

export function useReady() {
  const fetchFn = useCallback(() => fetchJson<BeadIssue[]>('/api/ready'), [])
  return usePolling(fetchFn)
}

export function useBlocked() {
  const fetchFn = useCallback(() => fetchJson<BeadIssue[]>('/api/blocked'), [])
  return usePolling(fetchFn)
}

export function useGitLog(branch: string, limit: number = 50) {
  const fetchFn = useCallback(
    () => fetchJson<GitCommit[]>(`/api/git-log?branch=${encodeURIComponent(branch)}&limit=${limit}`),
    [branch, limit]
  )
  return usePolling(fetchFn)
}

export function useBranches() {
  const fetchFn = useCallback(() => fetchJson<BranchesResponse>('/api/branches'), [])
  return usePolling(fetchFn, 30000)  // Branches change less often
}

export function useGitFileDiff(file: string) {
  const fetchFn = useCallback(
    () => file ? fetchJson<{ file: string; diff: string }>(`/api/git-diff?file=${encodeURIComponent(file)}`) : Promise.resolve(null),
    [file]
  )
  return usePolling(fetchFn, 10000)
}

export function useGitStatus() {
  const fetchFn = useCallback(() => fetchJson<{ status: string; path: string }[]>('/api/git-status'), [])
  return usePolling(fetchFn)
}

export function useProject() {
  const fetchFn = useCallback(() => fetchJson<{ name: string }>('/api/project'), [])
  return usePolling(fetchFn, 60000)  // Project name rarely changes
}

export function useFiles(dirPath: string) {
  const fetchFn = useCallback(
    () => fetchJson<FileEntry[]>(`/api/files?path=${encodeURIComponent(dirPath)}`),
    [dirPath]
  )
  return usePolling(fetchFn, 30000)  // Files change less frequently
}
