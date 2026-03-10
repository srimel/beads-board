export interface DependencyEdge {
  depends_on_id: string
  type: 'blocks' | 'parent-child' | string
}

export interface BeadIssue {
  id: string
  title: string
  status: string
  priority: number
  type: string
  issue_type?: string
  assignee?: string
  labels?: string[]
  dependencies?: string[] | DependencyEdge[]
  parent?: string
  description?: string
  created_at?: string
  updated_at?: string
}

export interface GitCommit {
  hash: string
  message: string
  body: string
  author: string
  date: string
}

export interface BranchesResponse {
  branches: string[]
  current: string
}
