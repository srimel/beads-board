# Contributing

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Beads CLI](https://github.com/steveyegge/beads) (`bd` command available in PATH)
- Git

## Setup

```bash
# Clone the repo
git clone https://github.com/srimel/beads-board.git
cd beads-board

# Install UI dependencies
cd ui && npm install
cd ..
```

The server has zero npm dependencies — no install step needed.

## Development Workflow

### Running the dev environment

Start the backend server and the Vite dev server in separate terminals:

```bash
# Terminal 1: Backend server
node server/index.js

# Terminal 2: Vite dev server with hot reload
cd ui && npm run dev
```

The Vite dev server proxies `/api` requests to `http://localhost:8377`, so the UI connects to the backend automatically.

### Building for production

```bash
npm run build
```

This runs `cd ui && npm run build`, which outputs to `server/dist/`. The built assets are committed to the repo so end users don't need a build step.

## Project Conventions

### Server

- **Zero npm dependencies.** The server uses only Node.js stdlib (`node:http`, `node:fs`, `node:child_process`, `node:path`, `node:url`). Do not add npm packages.
- **Single file.** All server code lives in `server/index.js`.
- **CLI over DB.** All data access goes through `bd <command> --json` and `git` commands. Never access Dolt/SQL directly.
- **Input validation.** Validate all user-supplied parameters (issue IDs, branch names, limits) before passing to CLI commands.

### UI

- **shadcn/ui for all components.** Use the shadcn component library for UI elements. Reference the LLM-optimized docs at https://ui.shadcn.com/llms.txt.
- **Tailwind CSS for layout.** Use Tailwind utility classes for positioning and spacing. Avoid custom CSS.
- **Dark theme default.** The app defaults to dark mode. Both dark and light themes must work.
- **TypeScript types in `ui/src/lib/types.ts`.** Keep API response types here.

### General

- **Commit built assets.** After UI changes, run `npm run build` and commit `server/dist/`.
- **Issue tracking with Beads.** Use `bd create`, `bd update`, `bd close` — not markdown TODOs.

## Testing Changes

1. Start the server: `node server/index.js`
2. Open http://localhost:8377 in your browser
3. Verify the kanban board shows issues from your `.beads/` project
4. Verify the git log shows commits with branch switching
5. Test the theme toggle
6. Check the browser console for errors

## Adding shadcn Components

```bash
cd ui
npx shadcn@latest add <component-name>
```

Components are installed to `ui/src/components/ui/`.
