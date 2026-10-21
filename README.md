# dsh-worktree

DeepSeek Harness 的并行 Git worktree 任务工具，采用 **用户 skill + 独立 CLI** 架构。

主项目目录仍然是可重置的统一调试槽：任务在独立 worktree 里开发，需要看效果时把任务改动临时复制到主项目目录验证，验证通过再合并回主项目并手动 commit。整个流程不会为了调试而做 WIP 提交。

> 当前版本 `0.2.0`。这是不兼容升级：Worktrees 面板、client bundle 和 host commands 已移除，改为 12 个 user-only skill + 1 个 `/worktree-commit`（用于自然语言“开始提交”）。状态和 worktree 默认留在仓库内，避免 DSH 的 workspace-write 沙箱每次提权；也支持切到 Claude/Codex 同款的外部布局。

---

## 0.2.0 的变化

- 删除 Worktrees 按钮、面板、`client.js` 和所有 client slot 注册。
- 删除 12 个 host commands，改为 12 个 user-only `/worktree-*` skill，外加 1 个唯一 model-invocable 的 `/worktree-commit`（用于自然语言“开始提交”）。
- 所有 Git 逻辑集中到独立 CLI `scripts/worktree-task.mjs`，不再依赖 DSH Host 的 `ctx.commands` / `ctx.subprocess` / `ctx.sessionQuery`。
- 任务状态默认仍在 `<repo>/.git/dsh-worktree/tasks.json`，新任务 worktree 默认仍在 `<repo>/.agents/worktrees`：这两处都在主会话 workspace 内，不会被 DSH 的 workspace-write 沙箱拦截。
- 也支持 Claude/Codex 同款的 home 状态和 sibling worktree；设置 `WORKTREE_STATE` / `WORKTREE_ROOT=sibling` 即可，但需要更宽的沙箱权限。
- 仍然可以通过 Plugins UI 安装：插件把 skill 包安装到 `~/.dsh/skills/worktree-*`、CLI/runtime 放到 `~/.dsh/dsh-worktree`，并启动一个 Host 侧轮询器自动注册新任务 workspace；不注册 client/command/runtime skill。

### 从 0.1.x 升级

- 先在 Plugins 里卸载旧版 `dsh-worktree-plugin`，再安装 0.2.0；旧 client bundle 可能被 profile 缓存，重装后重启 DSH。
- 旧任务状态默认仍从 `<repo>/.git/dsh-worktree/tasks.json` 读取；如果设置 `WORKTREE_STATE`，首次读取会导入到新位置。
- 旧任务 worktree 仍在 `.agents/worktrees`，新任务默认也在那里；确认任务都结束后再手动清理。
- 面板和 12 个 host command 已删除，改用 `/worktree-*` skill；输入 `/worktree-help` 查看新入口。

---

## 功能

- 创建独立 worktree 任务，任务分支和状态自动记录。
- 预览：先把主项目目录恢复到当前提交，再复制任务改动，不 commit，不反向同步。
- 合并：三方合并到主项目，不 commit；冲突时保留冲突状态，由 Agent 读取冲突文件、`:1/:2/:3` 三方版本和相关代码后给出语义级方案。
- 已手动合并并提交的任务不会重复重放补丁：检测到改动已被主线包含时直接对齐任务目录。
- 同步：把主项目最新提交带到单个或全部任务；已被主线吸收的任务自动对齐。
- SQL：拿取任务新增 `.sql` 文件，或提交、推送后同步回各任务。
- 结束：清理 worktree、分支和状态；有未合并改动或未合并提交时停止，确认放弃后再用 `--force`。
- 合并时自动带出任务会话记忆：你在任务会话里的要求 + 最后的助手总结。
- 插件安装时自动把新任务 worktree 注册为 workspace（约 2 秒内出现在左侧；不自动打开会话）。
- 12 个命令是 user-only skill：用户手动输入 `/worktree-*`，不注册模型工具，模型不能自行调用；`/worktree-commit` 是唯一的 model-invocable skill，只在用户明确说“开始提交/提交”时使用。

---

## 要求

- DeepSeek Harness `>=0.2.1-rc.2 <0.3.0`。
- Node.js `>=22`（CLI 使用 Node 内置 zstd 读取任务会话记忆）。
- Git。
- Linux 或 macOS；Windows 未实测。

---

## 安装

有两个安装方式，选一个即可。两个方式安装的是同一套 skill，不要同时用同一个目标目录。

### 方式 A：通过 Plugins UI 安装（推荐）

1. 打开 Web UI 侧边栏 **Plugins**。
2. **Add plugin** 旁的箭头 → **Install a third-party plugin**。
3. 填入安装源：

   ```text
   # 本地目录
   /path/to/dsh-worktree-plugin

   # GitHub 仓库
   github:pinyht/dsh-worktree-plugin

   # npm（发布后）
   dsh-worktree-plugin
   ```

4. 勾选信任框 → **Install** → **Enable now**。
5. 重启一次 DSH（插件在启动时把 13 个 skill 写入 `~/.dsh/skills/worktree-*`，CLI 和 lib 写入 `~/.dsh/dsh-worktree/`）。
6. 新开一个会话，输入 `/worktree-help` 验证。

插件本身不注册 skill、command 或 client；它负责安装自包含的 skill 包，并用 Host 的 `workspaceRegistry` 自动注册任务 workspace。这样即使之后卸载插件，skill 和 CLI 仍然可用。

> 为什么是这个布局：DSH 的 preset skill provider 只把一个 skill root 的**直接子目录**当成一个 skill bundle（读取 `<dir>/SKILL.md`），不会递归扫描嵌套 bundle。因此 13 个 skill 直接放在 `~/.dsh/skills/worktree-*`，CLI 和依赖放在 `~/.dsh/dsh-worktree/`。`~/.agents/skills` 里 Codex 的嵌套目录（`codex-cli-worktree/worktree-*`）DSH 不会识别，也就不会和 DSH 同名 skill 冲突。

### 方式 B：纯 skill 安装（不用插件）

```bash
git clone https://github.com/pinyht/dsh-worktree-plugin.git
cd dsh-worktree-plugin
node scripts/install.mjs
```

默认把 13 个 skill 装到 `~/.dsh/skills/worktree-*`，CLI/runtime 装到 `~/.dsh/dsh-worktree/`；也可以指定位置：

```bash
node scripts/install.mjs \
  --skills-root ~/.dsh/skills \
  --runtime-dir ~/.dsh/dsh-worktree
node scripts/install.mjs --force   # 覆盖已有同名安装
```

安装脚本会复制 skill、CLI 和 CLI 依赖的 `lib/`，并把 skill 里的 `{{CLI}}` 替换成实际路径。安装后新开会话或刷新页面即可。

### 卸载

- **插件安装**：Plugins → `dsh-worktree-plugin` → **Uninstall**。
- **纯 skill 安装**：删除 `~/.dsh/skills/worktree-*` 和 `~/.dsh/dsh-worktree/`。

两种方式都不会自动删除 worktree、任务分支或任务状态目录。先执行 `/worktree-end` 清理任务，再手动删除残留目录。

---

## 使用

### 基本模型

- **主项目目录**：可重置的统一调试槽。`/worktree-new`、`/worktree-switch`、`/worktree-merge`、`/worktree-sync`、SQL 和 `/worktree-end` 都在这里执行。
- **任务 worktree**：独立开发目录，默认在仓库内：

  ```text
  <repo>/.agents/worktrees/task-<任务名>-<hash>
  ```

  需要和 Claude/Codex 一样的 sibling 目录时，设置 `WORKTREE_ROOT=sibling`，任务会放到：

  ```text
  /path/to/repo.dsh-worktrees/task-<任务名>-<hash>
  ```

- **任务会话**：插件安装会自动把任务 worktree 注册为 workspace（不自动打开会话）；纯 skill 安装需要手动在 DSH 左侧 **Add workspace** 添加任务目录，再打开会话开发。
- **不自动启动服务、不自动 commit**；验证和提交由你决定。

### 推荐流程

假设任务叫 `修复登录跳转`：

1. 在主项目会话输入 `/worktree-new 修复登录跳转`，记下输出的任务目录。
2. 插件安装时任务 workspace 会自动出现在左侧；没有出现再手动 Add workspace 添加该目录，然后打开任务会话。
3. 在任务会话里改代码、跑必要的短命令；不要启动长期服务，也不要 commit。
4. 需要看效果时回主项目会话，输入 `/worktree-switch 修复登录跳转`，然后手动启动服务验证。
5. 验证完输入 `/worktree-switch --clear`，或直接预览另一个任务。
6. 开发完成后输入 `/worktree-merge 修复登录跳转`；有冲突时按 Agent 提示处理。
7. 在主项目目录重启服务验证；通过后直接说 **“开始提交”**（或输入 `/worktree-commit`），Agent 会自动读取任务会话记忆和主项目 diff，生成中文提交说明并 commit；不需要把记忆复制到输入框。
8. 主项目有新提交后，输入 `/worktree-sync 修复登录跳转` 或 `/worktree-sync --all`。
9. 任务完成后输入 `/worktree-end 修复登录跳转` 清理。

### 命令

12 个命令是 user-only skill（`disable-model-invocation: true`），不会被模型自动调用；只有 `/worktree-commit` 是 model-invocable，因为需要响应“开始提交/提交”这类自然语言，但仍然只在用户明确要求提交时使用。

| 命令 | 作用 |
|---|---|
| `/worktree-new <任务名>` | 创建任务 worktree |
| `/worktree-list` | 查看当前仓库任务 |
| `/worktree-info <任务名>` | 查看任务详情 |
| `/worktree-current` | 查看当前窗口对应任务或主项目状态 |
| `/worktree-status` | 查看当前 Git 未提交状态 |
| `/worktree-switch <任务名>` | 把任务改动复制到主项目目录预览 |
| `/worktree-switch --clear` | 清除预览并恢复主项目 |
| `/worktree-merge <任务名>` | 三方合并到主项目，不自动 commit |
| `/worktree-commit [任务名]` | 基于最近合并的任务记忆和 diff 生成提交说明并 commit |
| `/worktree-sync <任务名>` | 主项目最新提交带到任务 |
| `/worktree-sync --all` | 同步所有任务 |
| `/worktree-take-sql <任务名> <sql...>` | 拿取任务新增 SQL，不 commit |
| `/worktree-push-sql <任务名> <sql...>` | 拿取 SQL、commit、push 并同步到各任务 |
| `/worktree-end <任务名> [--force]` | 清理任务 |
| `/worktree-help` | 帮助 |

### 提交：不需要复制任务记忆

验证通过后，直接说：

```text
开始提交
```

或者输入 `/worktree-commit`。Agent 会：

1. 调用 `commit-context`，自动选择最近一次 `/worktree-merge` 的任务；
2. 读取该任务的 DSH 会话记忆（你的要求 + 最后总结），以及主项目 `git status` / `git diff`；
3. 生成中文提交说明；
4. 如果没有“本次合并之外的改动”，直接 `git add -A` + `git commit`，不 push；
5. 提交成功后更新任务状态。

如果发现主项目还有不属于本次合并的文件，skill 会先停下来问你，不会直接 `git add -A`。提交说明不依赖你手动复制任何内容。

### 关于 `--force`

`/worktree-end` 默认会拦住未合并改动、未解决冲突，以及任务分支上主线没有的提交。skill 会先说明风险，只有你明确确认放弃后才执行 `--force`。不要把 `--force` 当作 merge、review 或验证的替代。

---

## 合并冲突

- 非冲突改动由 `git apply --3way` 自动合入。
- 真正冲突时 CLI 停止，主项目目录保留冲突状态，任务目录不动。
- skill 要求 Agent 读取 `git status`、冲突文件、`:1/:2/:3` 三方版本，以及相关路由、权限、schema、配置、状态机代码，给出 2-3 个语义级方案，等你选择后再修改。
- 插件/CLI 不会自动 commit，也不会替你选方案。
- 你在主项目里解决冲突并提交后，可以再次执行 `/worktree-merge`：CLI 会识别任务改动已经被主线包含，直接把任务目录对齐到主线，不会重复应用补丁或再次制造冲突。

---

## 任务会话记忆

合并时，CLI 读取 `~/.dsh/sessions` 下按任务目录匹配的 DSH 会话：

- `user/message` 且 `source.kind === "user"` / `"agent-message"` 的用户原话；
- 最后一条 `assistant/message` 的 text block。

只读这两类内容，不读工具输出。一个完整任务约 2KB。找不到会话时降级为「未找到任务会话记忆」，只依据 diff 生成提交说明。

这是对 DSH 会话文件格式的只读适配；格式变化时最多退化为没有记忆，不会阻塞 worktree 操作。

---

## 数据位置

| 内容 | 默认位置 | 可选位置 |
|---|---|---|
| 任务状态 | `<repo>/.git/dsh-worktree/tasks.json` | `WORKTREE_STATE` 指向的目录（home 布局） |
| Worktree | `<repo>/.agents/worktrees/task-<任务名>-<hash>` | `WORKTREE_ROOT` 选择 |
| 任务分支 | `worktree/<slug>-<hash>` | — |
| Skills | `~/.dsh/skills/worktree-*/SKILL.md` | `scripts/install.mjs --skills-root` 可改 |
| CLI/runtime | `~/.dsh/dsh-worktree/` | `scripts/install.mjs --runtime-dir` 可改 |

默认状态和 worktree 都在主会话 workspace 内，DSH 的 workspace-write 沙箱可以直接读写，不需要每次提权。

如果设置 `WORKTREE_STATE` 切到 home 状态，首次读取时会从 `<repo>/.git/dsh-worktree/tasks.json` 导入一次旧状态。旧任务仍按状态里的绝对路径工作，不会自动搬目录。

### 修改 worktree 位置

CLI 读取 `WORKTREE_ROOT`（兼容旧的 `DSH_WORKTREE_ROOT`）：

```bash
WORKTREE_ROOT=agents dsh web    # 默认：<repo>/.agents/worktrees
WORKTREE_ROOT=sibling dsh web   # ../<repo>.dsh-worktrees（Claude/Codex 同款）
WORKTREE_ROOT=git dsh web       # <repo>/.git/dsh-worktrees
WORKTREE_ROOT=/abs/path dsh web
```

- `agents`（默认）：在仓库内，沙箱友好；`git clean -xfd` 会删掉。
- `sibling`：仓库外，和 Claude/Codex 一致；需要更宽的文件权限或 DSH 提权。
- `git`：在 `.git` 内，能躲过 `git clean -xfd`，但路径对编辑器不友好。

任务状态位置可用 `WORKTREE_STATE` 覆盖为 home 布局（默认不启用）。

> DSH 会把 `DSH_*` 环境变量从 agent 子进程里剥离，所以 skill 模式下请用 `WORKTREE_ROOT` / `WORKTREE_STATE` / `WORKTREE_DSH_HOME`，而不是 `DSH_WORKTREE_ROOT` / `DSH_WORKTREE_STATE`。旧的 `DSH_*` 名称仍作为兼容回退保留。

---

## 架构

```text
dsh-worktree-plugin/
├─ index.js                     # Cordis 入口：安装 skill 包
├─ lib/
│  ├─ plugin.js                 # apply：把 skill 包写入 ~/.dsh/skills
│  ├─ install-skills.js         # 共享安装逻辑
│  ├─ workspace-sync.js         # Host 侧自动注册任务 workspace
│  ├─ engine.js                 # worktree / state / switch / merge / sync / sql / end
│  ├─ git.js                    # 本地 Git runner（不依赖 DSH subprocess）
│  ├─ state.js                  # 默认 .git/dsh-worktree；可选 home 布局与迁移
│  ├─ dsh-sessions.js           # 只读 DSH 会话记忆
│  └─ errors.js
├─ skills/worktree-*/SKILL.md   # 12 个 user-only + 1 个 commit skill
├─ scripts/
│  ├─ worktree-task.mjs         # 独立 CLI
│  └─ install.mjs               # 纯 skill 安装
├─ cordis.patch.yml             # bundle 插入 Host 行
└─ test/
```

关键点：

- **Git 逻辑只在一处**：`lib/engine.js`，由 CLI 调用。
- **skill 只写执行纪律**：调用 CLI、展示输出、在边界处询问用户。
- **插件只做安装**：把 13 个 skill 复制到 `~/.dsh/skills`、CLI/lib 复制到 `~/.dsh/dsh-worktree`；不注册 client、command 或 runtime skill。
- **CLI 自包含**：安装时复制 `lib/` 和 `scripts/`，即使插件后来被卸载，skill 仍可运行。

---

## 开发与测试

```bash
cd /path/to/dsh-worktree-plugin
npm test
```

测试覆盖：

- `engine.test.js`：worktree / preview / merge / sync / SQL / end 全流程；
- `absorbed.test.js`：主线已包含任务改动时的 end/merge 回归；
- `sessions.test.js`：DSH 会话记忆读取；
- `state.test.js`：仓库内状态默认值与 home 状态迁移；
- `plugin.test.js`：插件安装 skill 包；
- `workspace-sync.test.js`：任务 workspace 自动注册；
- `cli.test.js`：独立 CLI 端到端；
- `cli-memory.test.js`：merge 后 `commit-context` 自动带出任务记忆并 `mark-committed`；
- `install.test.js`：纯 skill 安装。

修改后重新安装：

```bash
node scripts/install.mjs --force
```

如果是插件安装，重启 DSH 让插件重新复制 skill 包；skills 文件本身由 DSH 的文件监听刷新。

---

## 已知限制

- 每条命令都会经过一次模型回合；比 host command 慢，也会消耗 token。skill 要求 Agent 原样展示脚本输出，但最终呈现仍由模型完成。
- 插件安装会自动注册任务 workspace，但不会自动打开会话；纯 skill 安装需要手动 Add workspace。结束任务后需要手动删除或归档该 workspace。
- 任务会话记忆依赖 DSH 会话文件格式，格式变化时会退化为“无记忆”，不影响 Git 操作。
- `--force` 的安全性依赖 skill 指令和 Agent 遵守；不是宿主级硬约束。真正危险的操作前请自己确认。
- 不启动/重启项目服务；验证需要你手动做。
- 不自动 commit；只有 `/worktree-push-sql` 会 commit + push。
- 默认状态和 worktree 都在主会话 workspace 内，通常不需要提权；如果设置 `WORKTREE_ROOT=sibling` 或 `WORKTREE_STATE` 到 home，模型 bash 可能被 workspace-write 沙箱拒绝，需要按 DSH 的提权流程用同一命令重试。
- 只支持官方 Web / Desktop；TUI 未适配。Desktop 未在本机实测。
- 默认 worktree 仍是 `.agents/worktrees`；只有设置 `WORKTREE_ROOT=sibling` 才会使用 `<repo>.dsh-worktrees`。

---

## License

MIT
