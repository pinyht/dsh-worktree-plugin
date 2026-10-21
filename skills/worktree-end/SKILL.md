---
name: worktree-end
description: "清理任务 worktree、分支和本地状态。仅在用户输入 /worktree-end 时执行。"
argument-hint: "<任务名> [--force]"
disable-model-invocation: true
---

# worktree-end

当用户输入 `/worktree-end <任务名>` 时使用本 skill。

## 执行要求

- 必须在主项目目录执行。
- 从用户输入中提取任务名；任务名不能为空。
- 调用 `{{CLI}} end "<任务名>"`。
- 不要启动任何项目服务。
- 如果 CLI 因 DSH 文件沙箱拒绝删除 worktree、分支或状态目录，按 DSH 的提权流程用同一命令重试（sandbox_permissions / justification），不要改用其他方式绕过。
- 如果脚本提示任务改动已包含在主项目当前提交中，可以继续清理，这是正常结果。
- 如果脚本提示还有未合并改动、未解决冲突，或任务分支上有主线没有的提交：停止，把原因和影响原样告诉用户；不要擅自使用 `--force`。
- 只有在用户明确确认放弃任务 worktree 剩余差异后，才可调用 `{{CLI}} end "<任务名>" --force`。
- `--force` 会删除任务 worktree、任务分支和本地状态；不要用它代替 merge、review 或验证。
- 典型场景：冲突后通过人工或 AI 做了语义合并，主项目已经提交且工作区干净，但任务 worktree 的原始改动与最终提交不再完全一致，导致普通 end 仍提示未合并改动。此时先说明风险，再让用户确认是否放弃任务目录剩余差异。
- 清理成功后提醒用户：如果之前把任务目录添加为 workspace，需要在 DSH 左侧手动删除或归档该 workspace。
