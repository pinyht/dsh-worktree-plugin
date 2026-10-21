---
name: worktree-take-sql
description: "把任务新增的 SQL 文件拿到主项目目录，不自动 commit。仅在用户输入 /worktree-take-sql 时执行。"
argument-hint: "<任务名> <sql...>"
disable-model-invocation: true
---

# worktree-take-sql

当用户输入 `/worktree-take-sql <任务名> <sql...>` 时使用本 skill。

## 执行要求

- 必须在主项目目录执行。
- 调用 `{{CLI}} take-sql "<任务名>" "<sql1>" ["<sql2>" ...]`，文件参数逐个加引号。
- 不要启动任何项目服务；不要自动 commit。
- 如果 CLI 因 DSH 文件沙箱拒绝写入主项目目录、worktree 或状态目录，按 DSH 的提权流程用同一命令重试（sandbox_permissions / justification），不要改用其他方式绕过。
- 只支持任务中新增且未合并的 `.sql` 文件；如果脚本提示文件状态不符合、主项目已存在同路径文件或内容不一致，停止并告诉用户。
- 成功后告诉用户文件已复制到主项目目录、任务副本已删除，需要 review 后手动提交，再执行 `/worktree-sync <任务名>`。
