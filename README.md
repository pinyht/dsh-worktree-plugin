# dsh-worktree

DeepSeek Harness（Web / Desktop）的并行 Git worktree 任务插件。

它把「手动 `git worktree` → 手动加 workspace → 手动开 session → 手动复制改动预览 → 手动合并」收进一个 **Worktrees 面板 + 12 个用户命令**。主项目目录仍然是可重置的统一调试槽，任务在独立 worktree 里开发。

> 当前版本 `0.1.0`，面向官方 Web 与 Desktop。TUI 不在支持范围内。插件以本地目录安装为主，尚未发布 npm。

---

## 功能

- 在输入框左下角工具行显示 **Worktrees** 按钮；点开后在上方展开任务面板（任务列表、主项目状态、预览状态）。按钮不单独占一行。
- **新建任务** 创建 worktree，并自动注册 workspace、打开任务会话；不需要手动 Add workspace。
- 任务行支持 **打开 / 预览 / 合并 / 同步主线 / SQL / 结束**；面板头部支持 **同步全部**。
- 预览会把任务改动复制进主项目目录，不 commit，也不反向同步任务。
- 合并把任务改动三方合并回主项目目录，不自动 commit；冲突时保留冲突状态并给出冲突文件分析。
- 合并时自动带出任务会话记忆：你在任务会话里的要求 + 最后的助手总结。主项目会话因此同时拥有 why 和 what。
- 主项目有新提交后，可同步到单个或全部任务。
- 合并后可以把任务记忆一键填入输入框，让 Agent 基于 why + what 写提交说明。
- 任务有新增 `.sql` 时，面板出现 **SQL** 按钮：可「拿到主项目」或「提交并推送」。
- 命令结果在会话里直接展开显示；面板内部的 `--json` 读取只显示一行紧凑记录。
- 支持把任务新增的 SQL 文件拿到主项目，或一键提交、推送并同步回任务。
- 所有入口都是**用户命令 / 面板操作**，不注册模型工具；模型不能自行调用。

---

## 安装

### 安装到 Web profile（推荐）

1. 打开 Web UI 侧边栏 **Plugins**。
2. **Add plugin** 旁的箭头 → **Install a third-party plugin**。
3. 填入安装源，三种都可以：

   ```text
   # 本地目录
   /path/to/dsh-worktree-plugin

   # GitHub 仓库
   github:<你的用户名>/dsh-worktree-plugin

   # npm（发布后）
   dsh-worktree-plugin
   ```

4. 勾选信任框 → **Install** → **Enable now**。

也可以让 Agent 用 `plugin_manager` 的 `install_bundle`，target 传同样的 spec。

安装后，项目会话的输入框工具行里会出现 **Worktrees** 按钮；没有出现时刷新一次页面。当前会话不是 Git 仓库时，按钮仍显示，点开会提示先打开项目主目录会话。

### 安装到 Desktop

Desktop 使用保留的 `desktop` profile，由 Desktop 载体管理，`dsh plugin --profile desktop` 会被 CLI 拒绝。

- 在 Desktop 的 **Plugins** 页面安装同一个包；
- 如果 Desktop 的 Host 访问不到本地路径，用 `npm pack` 生成 tarball，安装时填 tarball 的绝对路径；或发布到 npm 后按包名安装。
- Desktop 的渲染尚未在本机实测。

### 卸载

- Plugins → 打开 `dsh-worktree-plugin` 详情页 → **Uninstall**；
- 或 `dsh plugin --profile web remove dsh-worktree-plugin`。

卸载只移除插件代码，**不会删除** worktree、任务分支或 `tasks.json`。先执行 `/worktree-end` 清理任务，或手动删除 `.agents/worktrees` 和 `.git/dsh-worktree`。

---

## 使用

### 面板

打开项目会话，输入框左下角的工具行里会出现一个 **Worktrees** 按钮，和 `+` / 工作区选择在同一行：

```text
[+] [工作区内修改] [🌿 Worktrees 3]          DeepSeek-V4.1-Flash  Max  [↑]
```

按钮不单独占一行。点开后，面板在输入框上方展开（会把输入框往下推，不遮挡对话），宽度与输入框一致；点「收起」关闭：

```text
┌ Worktrees ─────────────────────────────────────────────┐
│ [任务名，例如 修复登录跳转] [新建任务]                  │
│ 新建任务会创建 worktree，并自动打开任务会话。           │
│                                                          │
│ 修复登录跳转  有未合并改动  .../task-修复登录跳转-1a2b  │
│        [打开] [预览] [合并] [同步主线] [SQL 2] [结束]        │
│ 支付回调重试  干净          .../task-支付回调重试-3c4d  │
│        [打开] [预览] [合并] [同步主线] [结束]                │
└──────────────────────────────────────────────────────────┘
```

- **新建任务**：创建 worktree → 自动创建并打开任务会话（任务目录成为独立 workspace）。
- **打开**：打开该任务对应的 workspace/session；没有注册时自动注册。
- **预览**：把任务改动复制到主项目目录，主项目栏显示「正在预览」。
- **合并**：三方合并到主项目目录，不 commit；无冲突的改动自动写入。真正冲突时停止并保留冲突状态，不会替你选边；同时自动把冲突上下文交给当前 Agent（`agent.followup`），Agent 读取冲突文件、`:1/:2/:3` 三方版本和相关代码后给出 2-3 个语义方案，你选择后再修改。
- **同步主线**：把主项目最新提交 ff-only 带入该任务。
- **同步全部**：面板头部按钮，等价于 `/worktree-sync --all`。
- **SQL**：任务有新增 `.sql` 时出现。点开后列出新增 SQL，可「拿到主项目」（不 commit）或「提交并推送」（commit + push + 同步到各任务）；推送前会在面板内弹出确认条。一次处理该任务当前所有新增 SQL；路径含空格时请用命令。
- **收起**：把面板收回成工具行里的 Worktrees 按钮。
- **结束**：在面板内弹出确认条（不再用浏览器原生 confirm），确认后清理 worktree、分支、状态，并自动删除对应的空 workspace；有未合并改动会拦住。
- **填入提交说明请求**：合并成功后出现；把任务会话记忆和本次合并内容填入输入框，你确认后发送给 Agent。

### 和主项目的关联

- 任务 workspace 的标题会写成 `主项目 · 任务名`，例如 `my-project · 修复登录跳转`；
- 面板标题显示 `Worktrees · my-project`，工具行按钮的 tooltip 也带仓库名；
- 任务会话在左侧栏会有分支小图标（会话空闲时显示；运行中会被状态点占用）；
- 左侧栏切到 **View options → Group by → Workspace Tree** 后，任务 workspace 会因为路径在 `<repo>/.agents/worktrees/` 下而嵌套在主项目 workspace 下；这个视图选择是浏览器本地设置，一次切换后保留；
- 任务会话里打开 Worktrees，会显示「当前在任务会话」并提供 **主项目** 按钮；
- 已有任务在展开面板或点「打开」时，如果标题仍是默认的任务名/目录名/旧的 `主项目 / 任务名` 格式，会自动整理成 `主项目 · 任务名`；你手动改过的标题不会被覆盖；
- 如果主项目本身没有注册为 workspace，前缀会回退为主项目目录名。

### 合并冲突

- 非冲突改动由 `git apply --3way` 自动合入；
- 真正冲突时脚本停止，主项目目录保留冲突状态，任务目录不动；
- 命令会自动把冲突上下文通过 `agent.followup` 交给当前 Agent；
- Agent 会读取 `git status`、冲突文件、`:1/:2/:3` 三方版本，以及相关路由、权限、schema、配置、状态机代码；
- Agent 应给出 2-3 个语义级方案并说明影响，等你选择后再修改；插件不会自动 commit，也不会替你选方案；
- 面板会自动收起、焦点回到输入框，你可以直接看到 Agent 的分析；
- 如果自动提交冲突上下文失败，面板会保留「让 Agent 分析冲突」按钮作为兜底。

### 命令

全部是用户命令（输入框 `/worktree-...`），不产生模型工具，也不会被模型自动调用。

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
| `/worktree-sync <任务名>` | 主项目最新提交带到任务 |
| `/worktree-sync --all` | 同步所有任务 |
| `/worktree-take-sql <任务名> <sql...>` | 拿取任务新增 SQL，不 commit |
| `/worktree-push-sql <任务名> <sql...>` | 拿取 SQL、commit、push 并同步到各任务 |
| `/worktree-end <任务名> [--force]` | 清理任务 |
| `/worktree-help` | 帮助 |

`list` / `new` / `info` / `current` / `status` 支持 `--json`，面板内部使用。

命令结果会在会话里以展开卡片显示完整文本（不再只有折叠行）；面板内部的 `--json` 读取显示为一行紧凑记录，避免把 JSON 铺到对话里。

用户手动输入的命令执行完会自动把输入焦点放回输入框；面板按钮触发的命令带 `--panel`，不会抢走焦点。

面板上的一次性动作（打开、预览、合并、同步、新建任务、SQL 操作、结束确认等）完成后面板会自动收起，并把焦点放回输入框；需要继续操作时再点 Worktrees。需要面板内继续交互的动作（SQL 展开、结束确认、SQL 推送确认）不会提前收起。

---

## 推荐流程

1. 在主项目会话展开 Worktrees，点 **新建任务**，输入任务名。
2. 插件创建 worktree，并自动打开任务会话。
3. 在任务会话里改代码、跑短命令；不要启动长期服务，也不要提交。
4. 回主项目会话，点 **预览**；手动重启服务验证。
5. 验证完点 **清除预览**，或继续预览另一个任务。
6. 点 **合并**；有冲突时按提示让 Agent 读取冲突文件和 `:1/:2/:3` 三方版本后给出方案。
7. 在主项目目录重启服务验证；通过后点 **填入提交说明请求**，确认并发送给 Agent，或自己 `git commit`。
8. 主项目有新提交后，点任务行的 **同步主线**，或面板头部的 **同步全部**。
9. 任务完成后点 **结束** 清理。

---

## 数据位置

| 内容 | 位置 |
|---|---|
| 任务状态 | `<repo>/.git/dsh-worktree/tasks.json` |
| Worktree | 默认 `<repo>/.agents/worktrees/task-<任务名>-<hash>` |
| 任务分支 | `worktree/<slug>-<hash>` |

任务状态放在主项目 `.git` 内：不污染工作区，任务会话可读，主会话可写。

Worktree 默认放在 `.agents/worktrees`，与 DSH 原生实验性 worktree 运行时一致，且位于主项目 workspace 内。

### 修改 worktree 位置

插件读取 **DSH Host 进程**的环境变量 `DSH_WORKTREE_ROOT`：

```bash
DSH_WORKTREE_ROOT=git dsh web       # <repo>/.git/dsh-worktrees
DSH_WORKTREE_ROOT=sibling dsh web   # ../<repo>.worktrees
DSH_WORKTREE_ROOT=/abs/path dsh web
```

- `agents`（默认）：`<repo>/.agents/worktrees`，编辑器友好；但 `git clean -xfd` 会删掉。
- `git`：`<repo>/.git/dsh-worktrees`，能躲过 `git clean -xfd`，但路径对编辑器不友好。
- `sibling`：仓库外，需要主会话有更宽的文件权限；否则 Git 操作可能被 DSH 沙箱拒绝。

环境变量需要在启动 `dsh web` 时设置；修改后重启 Host。

---

## 任务会话与 Git 的限制

任务会话的 workspace 是任务目录，而 linked worktree 的 index/HEAD 元数据在主项目 `.git` 内，位于任务 workspace 之外。因此：

- 任务会话里编辑文件、`git diff`、读日志正常；
- 任务会话里 `git add` / `commit` / `reset` / `stash` 可能被 DSH 沙箱拒绝；
- 插件的 switch/merge/sync/take-sql/push-sql/end 会检查当前是否在主项目目录，在任务会话执行会报错。

这是原流程本来的约束：任务目录只开发，主项目目录负责预览、合并、验证和提交。插件的命令在任务会话里仍可安全执行 `list/current/status/info`，面板会禁用主项目操作并提供「主项目」按钮。

插件自身的 Git 操作通过 Host 的 `ctx.subprocess` 执行，属于**用户命令**，不注册模型工具；它不受任务会话沙箱限制，这是为了让主槽的 reset/merge/sync 可用。请只安装你信任的插件。

---

## 任务会话记忆

合并时，插件通过 `ctx.sessionQuery` 按任务目录找到会话，读取：

- `user/message` 且 `source.kind === "user"` / `"agent-message"` 的用户原话；
- 最后一条 `assistant/message` 的 text block。

只读这两类内容，不读工具输出。一个完整任务约 2KB。找不到会话时降级为「未找到任务会话记忆」，只依据 diff 生成提交说明。

---

## 目录结构

```text
dsh-worktree-plugin/
├─ index.js                 # Host 入口
├─ client.js                # Web/Desktop dock（纯 JS + React.createElement）
├─ cordis.patch.yml         # bundle 插入 Host 行
├─ package.json             # dsh.bundle.patch + dsh.client
├─ lib/
│  ├─ plugin.js             # apply / inject
│  ├─ commands.js           # 12 个用户命令
│  ├─ engine.js             # 状态、worktree、switch/merge/sync/sql/end、记忆
│  ├─ git.js                # ctx.subprocess / 本地测试 runner
│  ├─ state.js              # tasks.json 与 repo context
│  └─ errors.js
├─ locale/{en,zh}.json
├─ icon.svg
└─ test/
   ├─ engine.test.js        # 引擎全流程（本地 Git）
   ├─ host.test.js          # 命令注册 + Host runner
   └─ client-smoke.test.js  # Client 组件基本渲染
```

没有构建步骤：Host 与 Client 都是普通 ESM/浏览器 JS，本地目录安装即可加载。

---

## 开发与迭代

```bash
cd /path/to/dsh-worktree-plugin
npm test
```

修改后：

- Host 部分：HMR 可能直接生效；没有生效时在 Plugins 里关掉再打开 bundle，或重启 `dsh web`。
- Client 部分：重新加载页面；如果模块图没有更新，关掉再打开 bundle。
- 替换已安装包后，可能需要重启才能加载新的 JS 模块代。

### 适配新版 DSH

插件只依赖公开的 Host/Client 服务：

- Host：`ctx.commands`、`ctx.workingDirectory`、`ctx.subprocess`、`ctx.sessionQuery`
- Client：`ctx.slots`、`ctx.remote.commands`、`ctx.workspaces`、`ctx.uiWorkspace`
- slot：`conversation.input.left`（按钮）、`conversation.input.dock`（面板）、`conversation.chat.commandview`（命令结果展开）

升级 DSH 后：

1. 用 `cordis_inspect_query` 的 `Service` / `Slots` 确认方法签名与 slot 仍在；
2. 更新 `package.json` 的 `engines.dsh` 范围；
3. 跑 `npm test`，再在 Web 里验证面板与命令；
4. 如有 API 变化，优先改 `lib/plugin.js`（注入）、`lib/commands.js`（命令）、`client.js`（slot），引擎逻辑不动。

`engines.dsh` 当前为 `>=0.2.1-rc.2 <0.3.0`；不满足时插件管理器会阻止安装/激活。

---

## 已知限制

- 只支持官方 Web / Desktop；没有 TUI 适配。
- 任务会话的 Git 写操作受沙箱限制，见上文。
- 默认 `.agents/worktrees` 可能被 `git clean -xfd` 删除；需要时改用 `DSH_WORKTREE_ROOT=git`。
- 不自动 commit；只有 `/worktree-push-sql` 会 commit + push。
- 不启动/重启项目服务；验证需要你手动做。
- 面板的「打开」会在任务目录注册 workspace，并把 workspace 标题改成任务名；任务多了左边栏会变长。这是当前 v1 的 workspace 模式；后续可加「主 workspace + 切 cwd」模式。
- Worktrees 按钮在非 Git 仓库会话里也会显示；点开只会提示先打开项目会话。
- 面板操作会以命令形式记录在会话日志里；这是为了保证操作可审计，不是模型回合。
- 面板 SQL 操作一次处理该任务当前所有新增 SQL；需要挑选文件时用 `/worktree-take-sql` / `/worktree-push-sql` 命令。
- Desktop 未在本机实测。
- 图标/文案为 v1 占位，欢迎替换。

---

## 发布

包名已经是 `dsh-worktree-plugin`（npm 上未被占用）。

- **只推 GitHub**：保持 `package.json` 的 `private: true`，别人用 `github:<用户名>/dsh-worktree-plugin` 安装即可。
- **发布到 npm**：删除 `private`，补 `repository` / `homepage` / `bugs` 字段，然后：

  ```bash
  npm publish
  ```

  发布后安装源直接写 `dsh-worktree-plugin`。

升级 DSH 大版本时，记得同步更新 `engines.dsh` 范围。

## License

MIT
