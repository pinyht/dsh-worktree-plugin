---
name: worktree-current
description: "查看当前窗口对应的任务或主项目状态。仅在用户输入 /worktree-current 时执行。"
disable-model-invocation: true
---

# worktree-current

当用户输入 `/worktree-current` 时使用本 skill。

## 执行要求

- 调用 `{{CLI}} current`。
- 不要启动任何项目服务。
- 告诉用户当前是任务 worktree 还是主项目目录、任务名、分支和主项目目录。
- 如果是主项目目录，说明它当前是 switch 预览、主线基线，还是有未提交改动。
- 不要自行执行 git 命令或修改文件。
