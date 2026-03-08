# Plugin Restructure Design

## Goal

Restructure beads-board from project-local skills into a proper Claude Code plugin that users can install and use in any project with `.beads/`.

## Current State

- Skills live in `.claude/skills/` (project-local, only work inside this repo)
- `commands/` exists with plugin-style commands but uses `<plugin-dir>` placeholder
- No `.claude-plugin/plugin.json` manifest
- Server already supports `process.argv[2]` for project directory

## Target State

```
beads-board/
├── .claude-plugin/
│   └── plugin.json                   # Manifest with explicit paths
├── skills/
│   ├── beads-board-start/SKILL.md    # Uses ${CLAUDE_PLUGIN_ROOT}
│   └── beads-board-stop/SKILL.md
├── commands/
│   ├── start.md                      # Uses ${CLAUDE_PLUGIN_ROOT}
│   └── stop.md
├── server/
│   ├── index.js                      # Unchanged
│   └── dist/                         # Pre-built UI ships with plugin
├── ui/                               # Source (dev only)
├── CLAUDE.md
├── README.md
└── package.json
```

## Changes Required

1. Restore `.claude-plugin/plugin.json` with skills/commands paths
2. Move `.claude/skills/` → `skills/` at plugin root
3. Update skills to use `${CLAUDE_PLUGIN_ROOT}/server/index.js`
4. Update commands to use `${CLAUDE_PLUGIN_ROOT}` instead of placeholder
5. Add `.beads/` detection to start skill
6. Delete `.claude/skills/`
7. Update CLAUDE.md, README.md, docs/architecture.md

## Installation (end user)

```bash
claude --plugin-dir /path/to/beads-board   # local
claude plugin install beads-board          # marketplace (future)
```

## Usage

```
/beads-board:start    # Detects .beads/, launches dashboard
/beads-board:stop     # Stops server
```
