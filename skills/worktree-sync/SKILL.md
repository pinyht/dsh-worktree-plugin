---
name: worktree-sync
description: "把主项目最新提交带到任务目录。仅在用户输入 /worktree-sync 时执行。"
argument-hint: "<任务名> | --all"
disable-model-invocation: true
---

# worktree-sync

当用户输入 `/worktree-sync <任务名>` 或 `/worktree-sync --all` 时使用本 skill。

## 执行要求

- 必须在主项目目录执行。
- 单个任务：调用 `{{CLI}} sync "<任务名>"`。
- 全部任务：调用 `{{CLI}} sync --all`。
- 不要启动任何项目服务。
- 如果 CLI 因 DSH 文件沙箱拒绝写入主项目目录、worktree 或状态目录，按 DSH 的提权流程用同一命令重试（sandbox_permissions / justification），不要改用其他方式绕过。
- 如果脚本提示主项目目录有未提交改动，停止并告诉用户先处理。
- 如果脚本提示任务无法直接同步、存在会被覆盖的改动或冲突，停止并原样告诉用户处理建议；不要强制覆盖任务目录。
- `--all` 中出现部分任务失败时，把成功和失败列表都告诉用户，不要隐瞒退出码。
