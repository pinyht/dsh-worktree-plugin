# Changelog

## 0.2.0 - 2026-10-21

**Breaking: the Worktrees panel is gone. `dsh-worktree` is now a user-skill package plus a standalone CLI.**

- Removed `client.js`, the Worktrees panel, all client slots, and the 12 host commands.
- Added 12 user-only `/worktree-*` skills (`disable-model-invocation: true`) plus the model-invocable `/worktree-commit` commit skill under `skills/`.
- Added the standalone `scripts/worktree-task.mjs` CLI; all Git work goes through it and no longer depends on `ctx.commands`, `ctx.subprocess`, `ctx.sessionQuery`, or `agent.followup`.
- The Cordis plugin is now an installer: on boot it copies 13 skills to `~/.dsh/skills/worktree-*` and the CLI/lib runtime to `~/.dsh/dsh-worktree/`. It registers no client, command, or runtime skill. Skills are direct children of the skill root because DSH scans only one level per root.
- Added `scripts/install.mjs` for a pure skill install without the plugin.
- Added a host-side workspace poller: every known main workspace's task state is scanned and new task worktrees are registered through `ctx.workspaceRegistry` within ~2s. This restores auto-add without a client; sessions are still opened manually.
- Task state stays in `<repo>/.git/dsh-worktree/tasks.json` by default and can move to a home layout with `WORKTREE_STATE`. New task worktrees stay in `<repo>/.agents/worktrees` by default; `WORKTREE_ROOT=sibling` selects the Claude/Codex-style `<repo>.dsh-worktrees`.
- Kept the sandbox-safe defaults: the CLI runs through the agent bash tool, so default state and worktrees remain inside the main session workspace instead of requiring `workspace-write` escalation. Home/sibling layouts remain opt-in.
- Added the model-invocable `/worktree-commit` skill: `commit-context` re-reads the task's session memory plus main `git status`/`git diff`, so the agent can generate and commit a Chinese message when the user says “开始提交”; `mark-committed` updates task state after the commit.
- Added a read-only DSH session reader so merge and commit still include task session memory without `ctx.sessionQuery`.
- Added regression tests for absorbed changes, commit context/memory, state migration, session memory, plugin installation, the CLI, and the pure installer.

## 0.1.1 - 2026-10-21

- Fix ending a task whose worktree changes were already merged and committed in main: a conflicted three-way replay no longer marks the task as unmerged forever. The engine now compares per-file content (including conflict stages) and treats main-superset changes as absorbed.
- `merge` is idempotent after a manual merge: when the task's changes are already contained in main, it aligns the task worktree to main instead of replaying the patch into a duplicate conflict.
- The panel's End flow now offers an explicit **强制结束** confirmation when unmerged changes or unmerged task commits block cleanup, instead of failing with no way forward.
- Ending a previewed task now restores the main checkout before deleting the task; if restoration is blocked, the preview record is kept so `/worktree-switch --clear` can still recover it.
- Worktree removal now recovers from locked worktrees and prunes stale registrations; branch-deletion failures are reported without losing task state.
- Added `@deepseek-ai/dsh-client-ui-chat` to the client load graph so the custom `/worktree-*` command result cards render.

## 0.1.0 - 2026-10-19

- Initial release of the `dsh-worktree` plugin for DeepSeek Harness Web and Desktop.
- Worktree task panel with New/Open/Preview/Merge/Sync/SQL/End actions.
- Twelve user-only `/worktree-*` commands.
- Task workspace titles as `<project> · <task>`; automatic workspace cleanup on End.
- Native session-memory lookup through `ctx.sessionQuery`.
- Automatic merge-conflict handoff to the current Agent through `agent.followup`.
- Expanded command-result cards and composer refocus for user commands.
- Web/Desktop client module; no TUI support.
