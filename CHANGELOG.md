# Changelog

## 0.1.0 - 2026-10-19

- Initial release of the `dsh-worktree` plugin for DeepSeek Harness Web and Desktop.
- Worktree task panel with New/Open/Preview/Merge/Sync/SQL/End actions.
- Twelve user-only `/worktree-*` commands.
- Task workspace titles as `<project> · <task>`; automatic workspace cleanup on End.
- Native session-memory lookup through `ctx.sessionQuery`.
- Automatic merge-conflict handoff to the current Agent through `agent.followup`.
- Expanded command-result cards and composer refocus for user commands.
- Web/Desktop client module; no TUI support.
