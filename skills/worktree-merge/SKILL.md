---
name: worktree-merge
description: "把任务改动三方合并到主项目目录，不自动 commit。仅在用户输入 /worktree-merge 时执行。"
argument-hint: "<任务名>"
disable-model-invocation: true
---

# worktree-merge

当用户输入 `/worktree-merge <任务名>` 时使用本 skill。

## 执行要求

- 必须在主项目目录执行。
- 调用 `{{CLI}} merge "<任务名>"`。
- 不要启动任何项目服务；不要自动 commit。
- 如果 CLI 因 DSH 文件沙箱拒绝写入主项目目录、worktree 或状态目录，按 DSH 的提权流程用同一命令重试（sandbox_permissions / justification），不要改用其他方式绕过。
- 如果脚本提示任务改动已包含在主项目当前提交中，说明这是正常结果：任务目录已对齐主线，不需要再次合并。
- 如果脚本提示合并冲突并保留冲突状态：
  1. 不要修改文件，也不要 commit；
  2. 读取 `git status`、冲突文件、`:1/:2/:3` 三方版本，以及相关路由、权限、授权、schema、配置、状态机代码；
  3. 给出 2-3 个语义级修复方案，逐个说明影响和推荐项；
  4. 需要我决策时，用 ask_user_question 给出编号选项；
  5. 等我选择后再修改冲突文件，并告诉我如何验证。
- 如果脚本提示任务分支上有主线没有的提交，停止并把恢复命令告诉用户；不要用 `--force` 绕过。
- 合并成功后把待合并文件、任务会话记忆和验证建议告诉用户。
- 告诉用户：验证通过后直接说“开始提交”或输入 `/worktree-commit`，Agent 会基于任务会话记忆和主项目 diff 自动生成提交说明并 commit，不需要把记忆复制到输入框。
- 不要自行 commit；等用户明确说“开始提交/提交”后再使用 `/worktree-commit` 的流程。
