import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
let factory
const window = {
  __ModuleLoader__: {
    load(definition) {
      factory = definition.factory
    },
  },
}

const React = {
  createElement(type, props, ...children) {
    if (typeof type === 'function') return type({ ...(props ?? {}), children })
    return { type, props: props ?? {}, children }
  },
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}]
  },
  useCallback(fn) { return fn },
  useRef(initial) { return { current: initial ?? null } },
  useEffect() {},
  useMemo(fn) { return fn() },
}

vm.runInNewContext(code, {
  window,
  require(name) {
    if (name === 'react') return React
    throw new Error(`unexpected require: ${name}`)
  },
  console,
  JSON,
  Promise,
})

assert.equal(typeof factory, 'function')
const plugin = factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require: ${name}`)
})
assert.equal(plugin.inject.join(','), 'slots,remote,remote.commands,workspaces,uiWorkspace')

const components = new Map()
plugin.apply({
  slots: {
    inject(_key, callback) { callback() },
    register(definition, render) {
      components.set(definition.key ? `${definition.name}:${definition.key}` : definition.name, render)
      return () => {}
    },
  },
})
assert.ok(components.has('conversation.input.left'))
assert.ok(components.has('conversation.input.dock'))

const common = {
  sessionId: 'session-1',
  useWorkspaces: () => ({ items: [] }),
  inputActions: { setDraft() {} },
}
const button = components.get('conversation.input.left')(common)
assert.equal(button.type, 'button')
assert.ok(button.children.some((child) => child && child.children?.includes?.('Worktrees')))

assert.equal(components.get('conversation.input.dock')(common), null)
button.props.onClick()
const panel = components.get('conversation.input.dock')(common)
assert.equal(panel.type, 'div')
assert.ok(panel.children.length >= 1)

const command = components.get('conversation.chat.commandview:worktree-list')({
  node: { name: 'worktree-list', args: '', outcome: { kind: 'success', text: 'hello' } },
})
assert.equal(command.type, 'div')
assert.ok(JSON.stringify(command).includes('hello'))

console.log('CLIENT SMOKE TEST PASSED')
