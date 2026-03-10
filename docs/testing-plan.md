# Testing Plan

## Test Stack

- **Vitest** — test runner (native Vite integration, compatible with Jest API)
- **React Testing Library** — component rendering and interaction
- **@testing-library/jest-dom** — DOM assertion matchers
- **jsdom** — browser environment simulation

## What to Test

### 1. Pure utility functions (highest priority)
- `formatRelativeTime` in `CommitEntry.tsx` — relative date formatting
- `sortIssues` in `KanbanColumn.tsx` — issue sorting by priority/recency
- `cn` in `lib/utils.ts` — className merging (thin wrapper, low priority)
- `BEAD_ID_REGEX` matching in `CommitEntry.tsx` — bead ID detection in commit messages
- `normalizeIssue` in `server/index.js` — field normalization

### 2. React component rendering
- `BeadCard` — renders issue ID, title, priority, type badge, dependency count, assignee
- `CommitEntry` — renders commit hash, message with bead ID badges, relative time, author; tooltip on body
- `KanbanColumn` — renders column header with count, skeleton loading state, empty state, sort toggle
- `KanbanBoard` — categorizes issues into correct columns (backlog, ready, in progress, done)

### 3. Custom hooks
- `usePolling` — calls fetch function on mount and at intervals, handles errors, tracks loading state
- `useBeadsApi` hooks — correct API URL construction (can test `fetchJson` in isolation)

### 4. Server endpoints (lower priority, future work)
- `server/index.js` handler routing and input validation
- Git log parsing logic
- These require a different test setup (no jsdom, mock `child_process`) and are deferred

## Priority Order

1. **Extract and test pure functions** — `formatRelativeTime`, `sortIssues`, bead ID regex
2. **Component render tests** — `BeadCard`, `CommitEntry`, `KanbanColumn`
3. **Integration tests** — `KanbanBoard` column categorization logic
4. **Hook tests** — `usePolling` behavior
5. **Server tests** — deferred to a later issue

## Testing Patterns

### Pure functions
Extract into testable modules where needed. Test with standard input/output assertions.

### Components
Use `render()` from React Testing Library, query the DOM with `screen.getByText()` / `getByRole()`, assert presence and content. Avoid testing implementation details.

### Hooks
Use `renderHook()` from React Testing Library. Mock `fetch` with `vi.fn()`. Use `vi.useFakeTimers()` for polling interval tests.

### Server (future)
Mock `child_process.execFile` to simulate CLI output. Test `handleRequest` with mock req/res objects.

## File Organization

```
ui/src/__tests__/          # test files
  utils.test.ts            # pure function tests
  CommitEntry.test.tsx     # component tests
  KanbanBoard.test.tsx     # integration tests
ui/vitest.config.ts        # vitest configuration (or inline in vite.config.ts)
```
