---
name: worktree-status
description: "查看当前 Git 未提交状态。仅在用户输入 /worktree-status 时执行。"
disable-model-invocation: true
---

# worktree-status

当用户输入 `/worktree-status` 时使用本 skill。

## 执行要求

- 调用 `{{CLI}} status`。
- 不要启动任何项目服务。
- 把当前 Git 仓库、是否在任务 worktree、分支和 `git status` 输出告诉用户。
- 不要自行执行 git 命令或修改文件。
