---
name: worktree-help
description: "查看 worktree 任务命令帮助。仅在用户输入 /worktree-help 时执行。"
disable-model-invocation: true
---

# worktree-help

当用户输入 `/worktree-help` 时使用本 skill。

## 执行要求

- 调用 `{{CLI}} help`。
- 不要启动任何项目服务。
- 把脚本输出的命令列表和说明原样展示给用户；可以补充一句“所有命令都是用户手动触发，不会注册成模型工具”。
- 不要自行推断或省略命令参数。
