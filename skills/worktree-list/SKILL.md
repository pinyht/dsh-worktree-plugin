---
name: worktree-list
description: "查看当前仓库的并行 Git worktree 任务列表。仅在用户输入 /worktree-list 时执行。"
disable-model-invocation: true
---

# worktree-list

当用户输入 `/worktree-list` 时使用本 skill。

## 执行要求

- 调用 `{{CLI}} list`。
- 不要启动任何项目服务。
- 把任务名、状态、目录、分支和是否有未合并改动整理成简洁中文给用户；脚本原文里的错误和警告要保留关键部分，不要省略。
- 如果脚本提示当前目录不在 Git 工作区，告诉用户先打开项目主目录的会话。
