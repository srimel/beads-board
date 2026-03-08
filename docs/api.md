# API Reference

All endpoints are served by `server/index.js`. The server listens on port 8377 by default (auto-increments if taken).

All API responses return JSON with `Content-Type: application/json` and `Access-Control-Allow-Origin: *`.

## Endpoints

### GET /api/issues

Returns all issues from `bd list --json`.

**Response:** `BeadIssue[]`

```json
[
  {
    "id": "beads-board-r9g",
    "title": "Phase 0: Plugin manifest and stub server",
    "status": "closed",
    "priority": 2,
    "type": "task",
    "assignee": "",
    "labels": [],
    "dependencies": []
  }
]
```

Returns `[]` when no issues exist.

---

### GET /api/ready

Returns open issues with no unresolved blockers, from `bd ready --json`.

**Response:** `BeadIssue[]`

Same shape as `/api/issues`. Only includes issues with `status: "open"` and no blocking dependencies.

---

### GET /api/blocked

Returns issues with unresolved blockers, from `bd blocked --json`.

**Response:** `BeadIssue[]`

Same shape as `/api/issues`. Only includes issues that have unresolved blocking dependencies.

---

### GET /api/issue/:id

Returns a single issue by ID, from `bd show <id> --json`.

**Parameters:**
- `:id` — Issue ID (e.g., `beads-board-r9g`). Must match `/^[\w-]+$/`.

**Response:** `BeadIssue`

```json
{
  "id": "beads-board-r9g",
  "title": "Phase 0: Plugin manifest and stub server",
  "status": "closed",
  "priority": 2,
  "type": "task",
  "description": "Tasks 1-2: Create plugin.json, open.md slash command...",
  "assignee": "",
  "labels": [],
  "dependencies": []
}
```

**Errors:**
- `400` — Invalid issue ID format
- `500` — Issue not found or `bd` command failed

---

### GET /api/git-log

Returns recent git commits as JSON.

**Query Parameters:**
- `branch` (optional) — Branch name. Defaults to current branch. Must match `/^[\w\/.@{}-]+$/`.
- `limit` (optional) — Max commits to return. Defaults to 50. Clamped to 1–500.

**Response:** `GitCommit[]`

```json
[
  {
    "hash": "b28fa9b",
    "message": "feat: add start/stop slash commands, replace open command",
    "author": "Stuart Rimel",
    "date": "2026-03-08 13:25:43 -0700"
  }
]
```

**Errors:**
- `400` — Invalid branch name

---

### GET /api/branches

Returns all local branches and the current branch.

**Response:**

```json
{
  "branches": ["main", "feature-branch"],
  "current": "main"
}
```

---

## Error Responses

All errors return JSON:

```json
{
  "error": "description of what went wrong"
}
```

Common status codes:
- `400` — Invalid input (bad issue ID, branch name)
- `500` — Server error (bd/git command failed, not installed)

## TypeScript Types

```typescript
interface BeadIssue {
  id: string
  title: string
  status: string
  priority: number
  type: string
  assignee?: string
  labels?: string[]
  dependencies?: string[]
  description?: string
  created_at?: string
  updated_at?: string
}

interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
}

interface BranchesResponse {
  branches: string[]
  current: string
}
```
