---
name: worktree-new
description: "创建新的并行 Git worktree 任务。仅在用户输入 /worktree-new 时执行。"
argument-hint: "<任务名>"
disable-model-invocation: true
---

# worktree-new

当用户输入 `/worktree-new <任务名>` 时使用本 skill。

## 执行要求

- 必须在主项目目录执行。
- 从用户输入中提取任务名；任务名不能为空，不能包含空格、Tab、换行、路径分隔符或路径非法字符，且不能以 `-` 开头或结尾。
- 调用 `{{CLI}} new "<任务名>"`。
- 不要启动任何项目服务。
- 如果 CLI 因 DSH 文件沙箱拒绝写入主项目目录、worktree 或状态目录，按 DSH 的提权流程用同一命令重试（sandbox_permissions / justification），不要改用其他方式绕过。
- 如果脚本提示主项目目录不干净、任务已存在、分支已存在或目录已存在，停止并把原因告诉用户。
- 成功后把脚本输出的任务目录原样告诉用户，并提醒：在 DSH 左侧 Add workspace 添加该目录，打开任务会话继续开发。
- 不要自行执行 git worktree、git branch 或复制文件来复刻脚本。
