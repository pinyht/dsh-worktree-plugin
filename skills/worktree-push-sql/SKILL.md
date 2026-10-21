---
name: worktree-push-sql
description: "拿取任务新增 SQL，提交并推送后同步到各任务。仅在用户输入 /worktree-push-sql 时执行。"
argument-hint: "<任务名> <sql...>"
disable-model-invocation: true
---

# worktree-push-sql

当用户输入 `/worktree-push-sql <任务名> <sql...>` 时使用本 skill。

## 执行要求

- 必须在主项目目录执行。
- 先确认用户明确要求提交并推送；没有明确要求时不要执行。
- 调用 `{{CLI}} push-sql "<任务名>" "<sql1>" ["<sql2>" ...]`，文件参数逐个加引号。
- 不要启动任何项目服务。
- 如果 CLI 因 DSH 文件沙箱拒绝写入主项目目录、worktree 或状态目录，按 DSH 的提权流程用同一命令重试（sandbox_permissions / justification），不要改用其他方式绕过。
- 如果脚本提示拿取失败、主项目已有同路径文件、任务 SQL 内容不一致或 push 失败，停止并把原因告诉用户；不要重试或绕过。
- 成功后告诉用户提交信息、push 结果、哪些任务同步成功、哪些被阻止，以及当前预览的任务。
