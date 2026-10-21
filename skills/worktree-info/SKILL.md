---
name: worktree-info
description: "查看指定 worktree 任务的详情。仅在用户输入 /worktree-info 时执行。"
argument-hint: "<任务名>"
disable-model-invocation: true
---

# worktree-info

当用户输入 `/worktree-info <任务名>` 时使用本 skill。

## 执行要求

- 从用户输入中提取任务名；任务名不能为空。
- 调用 `{{CLI}} info "<任务名>"`。
- 不要启动任何项目服务。
- 把状态、分支、目录和主项目目录告诉用户；需要打开任务会话时，提醒用户在 DSH 左侧 Add workspace 添加任务目录。
- 不要自行执行 git 命令或修改文件。
