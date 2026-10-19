window.__ModuleLoader__.load({
  id: 'dsh-worktree-plugin',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useState } = React

    const TOKEN = {
      border: 'var(--dsw-alias-border-l1)',
      layer1: 'var(--dsw-alias-bg-layer-1)',
      layer2: 'var(--dsw-alias-bg-layer-2)',
      label: 'var(--dsw-alias-label-primary)',
      secondary: 'var(--dsw-alias-label-secondary)',
      brand: 'var(--dsw-alias-brand-primary)',
      error: 'var(--dsw-alias-state-error-primary)',
      success: 'var(--dsw-alias-state-success-primary)',
      warn: 'var(--dsw-alias-state-warn-primary)',
    }

    const styles = {
      toolButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        height: '28px',
        padding: '0 7px',
        border: 'none',
        borderRadius: '6px',
        background: 'transparent',
        color: TOKEN.secondary,
        fontSize: '12px',
        lineHeight: '20px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      toolButtonActive: {
        background: TOKEN.layer2,
      },
      toolLabel: {
        color: TOKEN.secondary,
      },
      badge: {
        padding: '0 5px',
        borderRadius: '999px',
        background: TOKEN.layer2,
        color: TOKEN.secondary,
        fontSize: '11px',
        lineHeight: '16px',
      },
      dot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        display: 'inline-block',
        flex: '0 0 auto',
      },
      newRow: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        rowGap: '6px',
        padding: '8px 10px',
        borderBottom: `1px solid ${TOKEN.border}`,
        fontSize: '12px',
        color: TOKEN.secondary,
      },
      shell: {
        width: '100%',
        maxWidth: 'var(--dsh-composer-card-max-width, 760px)',
        margin: '0 auto',
        padding: '0 var(--dsh-composer-dock-inset, 8px)',
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: 'flex-end',
      },
      grow: { flex: '1 1 auto', minWidth: 0 },
      title: { color: TOKEN.label, fontWeight: 600, whiteSpace: 'nowrap' },
      muted: { color: TOKEN.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      button: {
        border: `1px solid ${TOKEN.border}`,
        background: 'transparent',
        color: TOKEN.label,
        borderRadius: '6px',
        padding: '1px 7px',
        fontSize: '12px',
        lineHeight: '18px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      primary: {
        border: `1px solid ${TOKEN.brand}`,
        background: 'transparent',
        color: TOKEN.brand,
        borderRadius: '6px',
        padding: '1px 8px',
        fontSize: '12px',
        lineHeight: '18px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      danger: {
        border: `1px solid ${TOKEN.border}`,
        background: 'transparent',
        color: TOKEN.error,
        borderRadius: '6px',
        padding: '1px 7px',
        fontSize: '12px',
        lineHeight: '18px',
        cursor: 'pointer',
      },
      panel: {
        width: '100%',
        maxWidth: '100%',
        marginBottom: '6px',
        border: `1px solid ${TOKEN.border}`,
        borderRadius: '10px',
        background: TOKEN.layer1,
        overflow: 'hidden',
      },
      panelHead: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        rowGap: '6px',
        padding: '8px 10px',
        borderBottom: `1px solid ${TOKEN.border}`,
        fontSize: '12px',
        color: TOKEN.secondary,
      },
      task: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        rowGap: '4px',
        padding: '7px 10px',
        borderTop: `1px solid ${TOKEN.border}`,
        background: TOKEN.layer2,
        fontSize: '12px',
      },
      taskName: { color: TOKEN.label, fontWeight: 600, whiteSpace: 'nowrap' },
      input: {
        border: `1px solid ${TOKEN.border}`,
        background: TOKEN.layer2,
        color: TOKEN.label,
        borderRadius: '6px',
        padding: '2px 8px',
        fontSize: '12px',
        lineHeight: '18px',
        outline: 'none',
        minWidth: '150px',
      },
      conflictRow: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '8px 10px',
        borderBottom: `1px solid ${TOKEN.border}`,
        boxShadow: `inset 3px 0 0 ${TOKEN.warn}`,
        background: TOKEN.layer2,
        color: TOKEN.label,
        fontSize: '12px',
      },
      confirmRow: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '8px 10px',
        borderBottom: `1px solid ${TOKEN.border}`,
        boxShadow: `inset 3px 0 0 ${TOKEN.error}`,
        background: TOKEN.layer2,
        color: TOKEN.label,
        fontSize: '12px',
      },
      sqlRow: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        rowGap: '4px',
        padding: '6px 10px',
        borderTop: `1px solid ${TOKEN.border}`,
        background: TOKEN.layer1,
        fontSize: '12px',
        color: TOKEN.secondary,
      },
      commandCard: {
        margin: '6px 0',
        border: `1px solid ${TOKEN.border}`,
        borderRadius: '10px',
        background: TOKEN.layer1,
        overflow: 'hidden',
        fontSize: '12px',
      },
      commandHead: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '5px 9px',
        borderBottom: `1px solid ${TOKEN.border}`,
        color: TOKEN.secondary,
      },
      commandName: {
        color: TOKEN.label,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        fontFamily: 'var(--ds-font-family-code, monospace)',
      },
      commandText: {
        margin: 0,
        padding: '8px 10px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'var(--ds-font-family-code, monospace)',
        fontSize: '12px',
        lineHeight: 1.55,
        color: TOKEN.label,
        maxHeight: '360px',
        overflow: 'auto',
      },
      commandCompact: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '4px 0',
        padding: '3px 8px',
        border: `1px solid ${TOKEN.border}`,
        borderRadius: '8px',
        background: TOKEN.layer1,
        color: TOKEN.secondary,
        fontSize: '12px',
      },
      error: { color: TOKEN.error, fontSize: '12px', padding: '0 10px 8px' },
      notice: { color: TOKEN.success, fontSize: '12px', padding: '0 10px 8px' },
    }

    const COMMAND_NAMES = [
      'worktree-new',
      'worktree-list',
      'worktree-info',
      'worktree-current',
      'worktree-status',
      'worktree-switch',
      'worktree-merge',
      'worktree-sync',
      'worktree-take-sql',
      'worktree-push-sql',
      'worktree-end',
      'worktree-help',
    ]

    function icon(size = 14) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, style: { flex: '0 0 auto' },
      },
        h('circle', { cx: 6, cy: 5, r: 2.1 }),
        h('circle', { cx: 6, cy: 19, r: 2.1 }),
        h('circle', { cx: 18, cy: 9, r: 2.1 }),
        h('path', { d: 'M6 7.1v9.8' }),
        h('path', { d: 'M6 13.5c0-3.6 2.4-4.5 4.8-4.5h5' }),
        h('path', { d: 'M18 11.1v2.2c0 2.4-1.8 3.7-4 3.7h-2.4' }),
      )
    }

    function button(label, onClick, options = {}) {
      const style = options.danger ? styles.danger : options.primary ? styles.primary : styles.button
      return h('button', {
        type: 'button',
        style: { ...style, ...(options.disabled ? { opacity: 0.45, cursor: 'default' } : {}) },
        onClick: options.disabled ? undefined : onClick,
        title: options.title ?? label,
        disabled: options.disabled,
      }, label)
    }

    function canonical(value) {
      if (!value) return ''
      return String(value).replace(/[\\/]+$/, '')
    }

    function baseName(value) {
      if (!value) return ''
      const parts = String(value).split(/[\\/]+/).filter(Boolean)
      return parts[parts.length - 1] ?? ''
    }

    function isWorktreePath(value) {
      if (!value) return false
      const normalized = String(value).replace(/\\/g, '/')
      return normalized.includes('/.agents/worktrees/')
        || normalized.includes('/.git/dsh-worktrees/')
        || normalized.includes('/.dsh-worktrees/')
        || normalized.includes('.worktrees/')
    }

    function dirtyTone(dirty) {
      if (dirty === '干净' || dirty === '已被主线吸收') return TOKEN.success
      if (dirty === '有未合并改动') return TOKEN.warn
      if (dirty === '冲突或不可读') return TOKEN.error
      return TOKEN.secondary
    }

    function createUiStore() {
      const values = new Map()
      const listeners = new Set()
      const get = (sessionId) => {
        let value = values.get(sessionId)
        if (!value) {
          value = { expanded: false, summary: null }
          values.set(sessionId, value)
        }
        return value
      }
      const set = (sessionId, patch) => {
        values.set(sessionId, { ...get(sessionId), ...patch })
        for (const listener of listeners) listener()
      }
      const subscribe = (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
      return { get, set, subscribe }
    }

    function useShared(ui, sessionId) {
      const [value, setValue] = useState(() => ui.get(sessionId))
      useEffect(() => {
        setValue(ui.get(sessionId))
        return ui.subscribe(() => setValue(ui.get(sessionId)))
      }, [ui, sessionId])
      return value
    }

    function focusComposer() {
      if (typeof document === 'undefined') return
      const editors = Array.from(document.querySelectorAll('[data-composer-input]'))
      const editor = editors.find((candidate) => candidate.offsetParent !== null) ?? editors[0]
      editor?.focus?.({ preventScroll: true })
    }

    function WorktreeCommandRow({ node }) {
      const args = (node?.args ?? '').trim()
      const compact = args.includes('--json')
      const panel = args.includes('--panel')
      const outcome = node?.outcome
      const displayArgs = args.replace(/--json\b/g, '').replace(/--panel\b/g, '').trim()

      useEffect(() => {
        if (!node || !outcome || compact || panel) return
        const age = typeof node.time === 'number' ? Date.now() - node.time : Infinity
        if (age > 15000) return
        const timer = setTimeout(() => {
          const active = document.activeElement
          const editing = active && (
            active.getAttribute?.('contenteditable') === 'true'
            || active.tagName === 'INPUT'
            || active.tagName === 'TEXTAREA'
          )
          if (editing) return
          focusComposer()
        }, 60)
        return () => clearTimeout(timer)
      }, [node, outcome, compact, panel])

      if (!node) return null
      const name = node.name ? `/${node.name}` : 'command'

      if (!outcome) {
        return h('div', { style: styles.commandCompact },
          h('span', { style: styles.commandName }, name),
          h('span', { style: styles.muted }, '执行中…'),
        )
      }

      if (compact && outcome.kind === 'success') {
        return h('div', { style: styles.commandCompact },
          h('span', { style: styles.commandName }, name),
          h('span', { style: styles.muted }, '面板操作完成'),
        )
      }

      const isError = outcome.kind === 'error'
      return h('div', { style: styles.commandCard },
        h('div', { style: styles.commandHead },
          h('span', { style: styles.commandName }, name),
          displayArgs
            ? h('span', { style: { ...styles.muted, flex: '1 1 auto' }, title: displayArgs }, displayArgs)
            : h('span', { style: styles.grow }),
          h('span', { style: { color: isError ? TOKEN.error : TOKEN.success, fontSize: '11px' } }, isError ? '失败' : '完成'),
        ),
        outcome.text
          ? h('pre', { style: { ...styles.commandText, ...(isError ? { color: TOKEN.error } : {}) } }, outcome.text)
          : h('div', { style: styles.commandText }, isError ? '命令失败（无输出）。' : '已执行。'),
      )
    }

    function WorktreeSessionBadge({ sessionId, useSessions }) {
      const cwd = useSessions ? useSessions((state) => state.byId[sessionId]?.cwd) : undefined
      if (!isWorktreePath(cwd)) return null
      return h('span', {
        title: 'worktree 任务',
        'aria-label': 'worktree 任务',
        style: {
          display: 'inline-flex',
          width: '16px',
          height: '16px',
          alignItems: 'center',
          justifyContent: 'center',
          color: TOKEN.secondary,
          flex: '0 0 auto',
        },
      }, icon(11))
    }

    function WorktreeButton(props) {
      const { ui, sessionId } = props
      const state = useShared(ui, sessionId)
      const summary = state.summary
      const title = summary
        ? `${summary.repo ? `${summary.repo} · ` : ''}${summary.count} 个任务${summary.preview ? ` · 预览：${summary.preview}` : summary.dirty ? ' · 主项目有未提交改动' : ' · 主项目干净'}`
        : 'Worktrees 任务面板'
      return h('button', {
        type: 'button',
        style: { ...styles.toolButton, ...(state.expanded ? styles.toolButtonActive : {}) },
        title,
        'aria-label': 'Worktrees',
        onClick: () => ui.set(sessionId, { expanded: !state.expanded }),
      },
        icon(13),
        h('span', { style: styles.toolLabel }, 'Worktrees'),
        summary && summary.count > 0 ? h('span', { style: styles.badge }, String(summary.count)) : null,
        summary?.preview ? h('span', { style: { ...styles.dot, background: TOKEN.warn } }) : null,
        summary && !summary.preview && summary.dirty ? h('span', { style: { ...styles.dot, background: TOKEN.warn } }) : null,
      )
    }

    function WorktreePanel(props) {
      const { ctx, ui, sessionId, useWorkspaces, inputActions } = props
      const state = useShared(ui, sessionId)
      const expanded = state.expanded
      const workspaceSnapshot = useWorkspaces ? useWorkspaces((snapshot) => snapshot) : undefined
      const [data, setData] = useState(null)
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState(null)
      const [notice, setNotice] = useState(null)
      const [name, setName] = useState('')
      const [busy, setBusy] = useState(false)
      const [lastMerge, setLastMerge] = useState(null)
      const [sqlOpen, setSqlOpen] = useState(null)
      const [confirmEnd, setConfirmEnd] = useState(null)
      const [confirmSql, setConfirmSql] = useState(null)
      const [conflict, setConflict] = useState(null)

      const run = useCallback(async (line) => {
        const result = await ctx.remote.commands.execute(sessionId, line, [])
        if (!result.ok) throw new Error(result.error?.message ?? '命令被拒绝')
        if (!result.value) throw new Error(`命令未注册: ${line}`)
        const outcome = result.value.result
        if (outcome.kind === 'error') throw new Error(outcome.text)
        return outcome.text
      }, [ctx, sessionId])

      const hide = useCallback(() => {
        setConfirmEnd(null)
        setConfirmSql(null)
        setSqlOpen(null)
        ui.set(sessionId, { expanded: false })
      }, [ui, sessionId])

      const hideAndFocus = useCallback(() => {
        hide()
        setTimeout(focusComposer, 0)
      }, [hide])

      const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
          const text = await run('/worktree-list --json --panel')
          const payload = JSON.parse(text)
          setData(payload)
          ui.set(sessionId, {
            summary: {
              count: payload.tasks.length,
              preview: payload.main.preview?.task ?? null,
              dirty: !payload.main.clean,
              inTask: payload.inTask,
              repo: baseName(payload.repo),
            },
          })
        } catch (cause) {
          const message = cause?.message ?? String(cause)
          const friendly = message.includes('不在 Git 工作区')
            ? '当前会话不在 Git 仓库。请打开项目主目录的会话，再使用 Worktrees。'
            : message
          setError(friendly)
          ui.set(sessionId, { summary: null })
        } finally {
          setLoading(false)
        }
      }, [run, ui, sessionId])

      useEffect(() => {
        setData(null)
        setError(null)
        setNotice(null)
        setLastMerge(null)
        setSqlOpen(null)
        setConfirmEnd(null)
        setConfirmSql(null)
        setConflict(null)
      }, [sessionId])

      useEffect(() => {
        if (expanded) load()
      }, [expanded, sessionId, load])

      useEffect(() => {
        if (!expanded) {
          setConfirmEnd(null)
          setConfirmSql(null)
          setSqlOpen(null)
        }
      }, [expanded])

      const items = workspaceSnapshot?.items ?? []

      useEffect(() => {
        if (!data) return
        const repoTitle = items.find((item) => canonical(item.path) === canonical(data.repo))?.title || baseName(data.repo)
        for (const task of data.tasks) {
          const workspace = items.find((item) => canonical(item.path) === canonical(task.worktree))
          if (!workspace) continue
          const legacyTitle = repoTitle ? `${repoTitle} / ${task.name}` : null
          const defaults = [task.name, baseName(task.worktree), legacyTitle].filter(Boolean)
          if (!defaults.includes(workspace.title)) continue
          const fullTitle = repoTitle ? `${repoTitle} · ${task.name}` : task.name
          if (fullTitle !== workspace.title) {
            ctx.workspaces.rename(workspace.workspaceId, fullTitle).catch(() => {})
          }
        }
      }, [ctx, data, items])

      const ensureWorkspace = useCallback(async (target, title, parentPath) => {
        const wanted = canonical(target)
        const existing = items.find((item) => canonical(item.path) === wanted)
        const parentTitle = parentPath
          ? (items.find((item) => canonical(item.path) === canonical(parentPath))?.title || baseName(parentPath))
          : ''
        const fullTitle = title && parentTitle ? `${parentTitle} · ${title}` : title
        const legacyTitle = title && parentTitle ? `${parentTitle} / ${title}` : null
        if (existing) {
          const defaultTitles = [title, baseName(target), legacyTitle].filter(Boolean)
          if (fullTitle && defaultTitles.includes(existing.title)) {
            try {
              await ctx.workspaces.rename(existing.workspaceId, fullTitle)
            } catch {
              // Keep the existing title when renaming is refused.
            }
          }
          return existing.workspaceId
        }
        const view = await ctx.workspaces.create({ path: target })
        const id = view?.workspaceId ?? view?.workspace?.workspaceId
        if (!id) throw new Error('创建 workspace 失败')
        if (fullTitle) {
          try {
            await ctx.workspaces.rename(id, fullTitle)
          } catch {
            // A title collision must not block opening the task session.
          }
        }
        return id
      }, [ctx, items])

      const openPath = useCallback(async (target, title, parentPath) => {
        setBusy(true)
        setError(null)
        try {
          const workspaceId = await ensureWorkspace(target, title, parentPath)
          await ctx.uiWorkspace.openWorkspace(workspaceId)
          hide()
        } catch (cause) {
          setError(cause?.message ?? String(cause))
        } finally {
          setBusy(false)
        }
      }, [ctx, ensureWorkspace, hide])

      const refresh = useCallback(async () => {
        await load()
      }, [load])

      const createTask = useCallback(async () => {
        const taskName = name.trim()
        if (!taskName) return
        setBusy(true)
        setError(null)
        setNotice(null)
        try {
          const text = await run(`/worktree-new ${taskName} --json --panel`)
          const payload = JSON.parse(text)
          setName('')
          await openPath(payload.task.worktree, payload.task.name, payload.repo)
        } catch (cause) {
          setError(cause?.message ?? String(cause))
        } finally {
          setBusy(false)
        }
      }, [name, run, openPath])

      const act = useCallback(async (task, action) => {
        setBusy(true)
        setError(null)
        setNotice(null)
        setLastMerge(null)
        setSqlOpen(null)
        setConfirmEnd(null)
        setConfirmSql(null)
        setConflict(null)
        try {
          const line = `/worktree-${action} ${task.name} --panel`
          const text = await run(line)
          let cleanupNote = ''
          if (action === 'end') {
            const workspace = items.find((item) => canonical(item.path) === canonical(task.worktree))
            if (workspace) {
              try {
                await ctx.workspaces.delete(workspace.workspaceId)
              } catch {
                cleanupNote = '（workspace 未能自动删除，请手动删除）'
              }
            }
          }
          setNotice(text.split('\n').filter(Boolean).slice(0, 2).join(' ') + cleanupNote)
          const autoConflict = action === 'merge' && text.includes('已交给 Agent 分析')
          if (autoConflict) setConflict({ taskName: task.name, text })
          else if (action === 'merge') setLastMerge({ taskName: task.name, text })
          await load()
          hideAndFocus()
        } catch (cause) {
          const message = cause?.message ?? String(cause)
          setError(message)
          if (action === 'merge' && message.includes('已保留冲突状态')) {
            setConflict({ taskName: task.name, text: message })
          }
        } finally {
          setBusy(false)
        }
      }, [ctx, hideAndFocus, items, run, load])

      const clearPreview = useCallback(async () => {
        setBusy(true)
        setError(null)
        try {
          const text = await run('/worktree-switch --clear --panel')
          setNotice(text)
          await load()
          hideAndFocus()
        } catch (cause) {
          setError(cause?.message ?? String(cause))
        } finally {
          setBusy(false)
        }
      }, [hideAndFocus, run, load])

      const fillCommitRequest = useCallback(() => {
        if (!lastMerge || !inputActions) return
        const prompt = [
          `任务「${lastMerge.taskName}」已合并到主项目目录，但还没有 commit。`,
          '',
          lastMerge.text,
          '',
          '请先查看 git diff 和 git status，然后给出一个中文提交说明（只给说明，不要直接 commit）。',
          '等我确认后再执行 commit。',
        ].join('\n')
        inputActions.setDraft(prompt)
        setNotice('已填入提交说明请求，确认后发送。')
        hideAndFocus()
      }, [lastMerge, inputActions, hideAndFocus])

      const syncAll = useCallback(async () => {
        setBusy(true)
        setError(null)
        setNotice(null)
        try {
          const text = await run('/worktree-sync --all --panel')
          setNotice(text.split('\n').filter(Boolean).slice(0, 2).join(' '))
          await load()
          hideAndFocus()
        } catch (cause) {
          setError(cause?.message ?? String(cause))
        } finally {
          setBusy(false)
        }
      }, [hideAndFocus, run, load])

      const sqlAction = useCallback(async (task, files, action) => {
        if (!files.length) return
        if (files.some((file) => /\s/.test(file))) {
          setError('SQL 路径包含空格，暂不支持面板操作，请使用 /worktree-... 命令。')
          return
        }
        setConfirmSql(null)
        setBusy(true)
        setError(null)
        setNotice(null)
        try {
          const text = await run(`/worktree-${action} ${task.name} ${files.join(' ')} --panel`)
          setNotice(text.split('\n').filter(Boolean).slice(0, 2).join(' '))
          setSqlOpen(null)
          await load()
          hideAndFocus()
        } catch (cause) {
          setError(cause?.message ?? String(cause))
        } finally {
          setBusy(false)
        }
      }, [hideAndFocus, run, load])

      const fillConflictRequest = useCallback(() => {
        if (!conflict || !inputActions) return
        const prompt = [
          `任务「${conflict.taskName}」合并到主项目时发生冲突，主项目目录现在处于冲突状态。`,
          '',
          conflict.text,
          '',
          '请你读取冲突文件、git status、git diff --name-only --diff-filter=U，以及 :1/:2/:3 三方版本，结合路由、权限、授权、schema、配置、状态机等相关代码。',
          '给出 2-3 个语义级修复方案，逐个说明影响和推荐项；如果需要我决策，用 ask_user_question 给出编号选项。',
          '不要直接 commit，等我选择后再修改。',
        ].join('\n')
        inputActions.setDraft(prompt)
        hideAndFocus()
      }, [conflict, inputActions, hideAndFocus])

      const summary = useMemo(() => {
        if (loading) return '读取中…'
        if (!data) return ''
        const count = data.tasks.length
        if (data.main.preview) return `${count} 个任务 · 预览: ${data.main.preview.task}`
        if (!data.main.clean) return `${count} 个任务 · 主项目有未提交改动`
        return `${count} 个任务 · 主项目干净`
      }, [data, loading])

      if (!expanded) return null

      const repoLabel = data ? baseName(data.repo) : ''
      const header = h('div', { style: styles.panelHead },
        icon(13),
        h('span', { style: styles.title }, repoLabel ? `Worktrees · ${repoLabel}` : 'Worktrees'),
        h('span', { style: { ...styles.grow, ...styles.muted }, title: summary }, summary),
        data && data.inTask ? button('主项目', () => openPath(data.repo), { title: `打开主项目 ${data.repo}`, disabled: busy }) : null,
        data && !data.inTask && data.tasks.length
          ? button('同步全部', syncAll, { disabled: busy, title: '把主项目最新提交带到所有任务' })
          : null,
        button('刷新', refresh, { disabled: loading || busy }),
        button('收起', hide),
      )

      const noRepo = typeof error === 'string' && error.startsWith('当前会话不在 Git 仓库')
      const body = []
      if (data?.inTask) {
        body.push(h('div', { key: 'task-session', style: styles.panelHead },
          `当前在任务会话「${data.taskName}」。切换、合并、同步、清理请在主项目会话执行。`,
        ))
      } else if (!noRepo) {
        body.push(h('div', { key: 'new', style: styles.newRow },
          h('input', {
            style: { ...styles.input, flex: '0 1 260px' },
            value: name,
            placeholder: '任务名，例如 修复登录跳转',
            onChange: (event) => setName(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') createTask() },
          }),
          button('新建任务', createTask, { primary: true, disabled: busy || !name.trim() }),
          h('span', { style: { ...styles.grow, ...styles.muted, textAlign: 'right' } }, '新建任务会创建 worktree，并自动打开任务会话。'),
        ))
      }

      if (data?.main?.preview) {
        body.push(h('div', { key: 'preview', style: styles.panelHead },
          h('span', { style: styles.grow }, `主项目正在预览：${data.main.preview.task}`),
          button('清除预览', clearPreview, { disabled: busy }),
        ))
      }

      if (!data && loading) {
        body.push(h('div', { key: 'loading', style: styles.panelHead }, '正在读取任务…'))
      }

      if (data && data.tasks.length === 0) {
        body.push(h('div', { key: 'empty', style: styles.panelHead }, '这个仓库还没有 worktree 任务。'))
      }

      for (const task of data?.tasks ?? []) {
        const sqlFiles = (task.changes ?? [])
          .filter((change) => change.status === 'A' && change.path.toLowerCase().endsWith('.sql'))
          .map((change) => change.path)
        body.push(h('div', { key: task.name, style: styles.task },
          h('span', { style: { ...styles.taskName, flex: '0 0 auto' } }, task.name),
          h('span', {
            style: { ...styles.muted, color: dirtyTone(task.dirty), flex: '0 0 auto' },
            title: (task.changes ?? []).map((change) => `${change.status} ${change.path}`).join('\n') || task.dirty,
          }, task.dirty),
          h('span', { style: { ...styles.grow, ...styles.muted }, title: task.worktree }, task.worktree),
          button('打开', () => openPath(task.worktree, task.name, data?.repo), { primary: true, disabled: busy || !task.exists }),
          button('预览', () => act(task, 'switch'), { disabled: busy || !task.exists || data?.inTask }),
          button('合并', () => act(task, 'merge'), { disabled: busy || !task.exists || data?.inTask }),
          button('同步主线', () => act(task, 'sync'), { disabled: busy || !task.exists || data?.inTask, title: '把主项目最新提交带到该任务' }),
          sqlFiles.length
            ? button(`SQL ${sqlFiles.length}`, () => setSqlOpen(sqlOpen === task.name ? null : task.name), {
                disabled: busy || data?.inTask,
                title: `新增 SQL:\n${sqlFiles.join('\n')}`,
              })
            : null,
          button('结束', () => setConfirmEnd(task), { danger: true, disabled: busy || data?.inTask }),
        ))
        if (sqlOpen === task.name && sqlFiles.length) {
          body.push(h('div', { key: `${task.name}-sql`, style: styles.sqlRow },
            h('span', { style: { ...styles.grow, ...styles.muted }, title: sqlFiles.join('\n') }, `新增 SQL: ${sqlFiles.join(', ')}`),
            button('拿到主项目', () => sqlAction(task, sqlFiles, 'take-sql'), { disabled: busy || data?.inTask }),
            button('提交并推送', () => setConfirmSql({ task, files: sqlFiles }), { primary: true, disabled: busy || data?.inTask }),
            button('取消', () => setSqlOpen(null)),
          ))
        }
      }

      if (lastMerge) {
        body.push(h('div', { key: 'merge-context', style: styles.panelHead },
          h('span', { style: styles.grow }, `已合并：${lastMerge.taskName}。可以把任务记忆填入输入框，让 Agent 写提交说明。`),
          button('填入提交说明请求', fillCommitRequest, { primary: true, disabled: busy || !inputActions }),
        ))
      }

      if (error) body.push(h('div', { key: 'error', style: styles.error }, error))
      if (notice) body.push(h('div', { key: 'notice', style: styles.notice }, notice))
      let confirmRow = null
      if (confirmEnd) {
        confirmRow = h('div', { key: 'confirm-end', style: styles.confirmRow },
          h('span', { style: { ...styles.grow, color: TOKEN.label } }, `确认清理任务「${confirmEnd.name}」？worktree 和分支会被删除。`),
          button('取消', () => setConfirmEnd(null)),
          button('确认清理', () => act(confirmEnd, 'end'), { danger: true }),
        )
      } else if (confirmSql) {
        confirmRow = h('div', { key: 'confirm-sql', style: styles.confirmRow },
          h('span', { style: { ...styles.grow, color: TOKEN.label }, title: confirmSql.files.join('\n') },
            `确认提交并推送 ${confirmSql.files.length} 个 SQL 文件？`,
          ),
          button('取消', () => setConfirmSql(null)),
          button('确认提交并推送', () => sqlAction(confirmSql.task, confirmSql.files, 'push-sql'), { primary: true }),
        )
      }

      const conflictRow = conflict
        ? h('div', { key: 'conflict', style: styles.conflictRow },
            h('span', { style: { ...styles.grow, color: TOKEN.label } }, `任务「${conflict.taskName}」合并冲突未解决，需要语义决策。`),
            button('让 Agent 分析冲突', fillConflictRequest, { primary: true, disabled: busy || !inputActions }),
          )
        : null

      return h('div', { style: styles.shell },
        h('div', { style: styles.panel },
          header,
          confirmRow,
          conflictRow,
          h('div', { style: { maxHeight: '320px', overflowY: 'auto' } }, ...body),
        ),
      )
    }

    return {
      inject: ['slots', 'remote', 'remote.commands', 'workspaces', 'uiWorkspace'],
      apply(ctx) {
        const ui = createUiStore()
        const Button = (props) => h(WorktreeButton, { ...props, ctx, ui })
        const Panel = (props) => h(WorktreePanel, { ...props, ctx, ui })
        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'worktrees',
          order: 30,
        }, Button))
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'worktrees',
          order: 15,
        }, Panel))
        ctx.slots.inject('sidebar.session.row.leading', () => ctx.slots.register({
          name: 'sidebar.session.row.leading',
          id: 'worktrees',
          order: 5,
        }, WorktreeSessionBadge))
        ctx.slots.inject('conversation.chat.commandview', () => {
          const disposers = COMMAND_NAMES.map((name) => ctx.slots.register({
            name: 'conversation.chat.commandview',
            key: name,
          }, WorktreeCommandRow))
          return () => {
            for (const dispose of disposers) dispose()
          }
        })
      },
    }
  },
})
