---
name: worktree-switch
description: "把任务改动复制到主项目目录做临时预览，或清除预览。仅在用户输入 /worktree-switch 时执行。"
argument-hint: "<任务名> | --clear"
disable-model-invocation: true
---

# worktree-switch

当用户输入 `/worktree-switch <任务名>` 或 `/worktree-switch --clear` 时使用本 skill。

## 执行要求

- 必须在主项目目录执行。
- 预览：调用 `{{CLI}} switch "<任务名>"`。
- 清除：调用 `{{CLI}} switch --clear`。
- 不要启动任何项目服务。
- 如果 CLI 因 DSH 文件沙箱拒绝写入主项目目录、worktree 或状态目录，按 DSH 的提权流程用同一命令重试（sandbox_permissions / justification），不要改用其他方式绕过。
- 如果脚本提示主项目目录有来源不明的未提交改动，停止并告诉用户先手动提交、stash 或清理；不要自行 reset 或 clean。
- 如果脚本提示任务分支上有主线没有的提交，停止并把恢复命令告诉用户；不要用 `--force` 绕过。
- 预览成功后告诉用户可以在主项目目录手动启动服务验证；不要自动 commit。
