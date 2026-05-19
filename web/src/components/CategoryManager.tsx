import { createSignal, For, Show } from 'solid-js'
import { bspTree, bspModules } from '../api/client'

interface BSPModule {
  id: number
  name: string
  slug: string
  icon: string
  bug_count: number
  wiki_count: number
  children?: BSPModule[]
}

export default function CategoryManager(props: { onClose: () => void }) {
  const [tree, setTree] = createSignal<BSPModule[]>([])
  const [newName, setNewName] = createSignal('')
  const [addingTo, setAddingTo] = createSignal<number | null>(null)
  const [childName, setChildName] = createSignal('')
  const [editingId, setEditingId] = createSignal<number | null>(null)
  const [editName, setEditName] = createSignal('')
  const [error, setError] = createSignal('')

  const loadTree = async () => {
    try {
      const data = await bspTree()
      setTree(data as BSPModule[])
    } catch {}
  }
  loadTree()

  const addRoot = async () => {
    const name = newName().trim()
    if (!name) return
    setError('')
    try {
      await bspModules.create({ name })
      setNewName('')
      loadTree()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const addChild = async () => {
    const name = childName().trim()
    const parentId = addingTo()
    if (!name || !parentId) return
    setError('')
    try {
      await bspModules.create({ name, parent_id: parentId })
      setChildName('')
      setAddingTo(null)
      loadTree()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const startEdit = (mod: BSPModule) => {
    setEditingId(mod.id)
    setEditName(mod.name)
  }

  const saveEdit = async () => {
    const name = editName().trim()
    const id = editingId()
    if (!name || !id) return
    setError('')
    try {
      await bspModules.update(id, { name })
      setEditingId(null)
      loadTree()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const deleteModule = async (mod: BSPModule) => {
    setError('')
    try {
      await bspModules.delete(mod.id)
      loadTree()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={props.onClose}>
      <div class="bg-card border border-border/50 rounded-xl w-[480px] max-h-[70vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <h3 class="text-white font-semibold">Manage Categories</h3>
          <button onClick={props.onClose} class="text-gray-500 hover:text-white transition text-lg">&times;</button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-2">
          <For each={tree()}>
            {(mod) => (
              <div>
                <div class="flex items-center gap-2 group">
                  <Show when={editingId() === mod.id} fallback={
                    <>
                      <span class="flex-1 text-gray-200 text-sm font-medium truncate">{mod.name}</span>
                      <span class="text-[10px] text-gray-500 font-mono">{mod.wiki_count}w {mod.bug_count}b</span>
                      <button onClick={() => startEdit(mod)} class="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-accent text-xs transition">edit</button>
                      <button onClick={() => setAddingTo(mod.id)} class="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-secondary text-xs transition">+child</button>
                      <button onClick={() => deleteModule(mod)} class="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs transition">del</button>
                    </>
                  }>
                    <input
                      type="text"
                      value={editName()}
                      onInput={(e) => setEditName(e.currentTarget.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                      class="flex-1 bg-surface border border-border/30 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-accent/40"
                      autofocus
                    />
                    <button onClick={saveEdit} class="text-accent text-xs hover:underline">save</button>
                    <button onClick={() => setEditingId(null)} class="text-gray-500 text-xs hover:underline">cancel</button>
                  </Show>
                </div>
                {/* Children */}
                <Show when={mod.children && mod.children.length > 0}>
                  <div class="ml-5 mt-1 space-y-1">
                    <For each={mod.children}>
                      {(child) => (
                        <div class="flex items-center gap-2 group">
                          <Show when={editingId() === child.id} fallback={
                            <>
                              <span class="flex-1 text-gray-400 text-sm truncate">└ {child.name}</span>
                              <span class="text-[10px] text-gray-600 font-mono">{child.wiki_count}w</span>
                              <button onClick={() => startEdit(child)} class="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-accent text-xs transition">edit</button>
                              <button onClick={() => deleteModule(child)} class="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs transition">del</button>
                            </>
                          }>
                            <input
                              type="text"
                              value={editName()}
                              onInput={(e) => setEditName(e.currentTarget.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                              class="flex-1 bg-surface border border-border/30 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-accent/40"
                              autofocus
                            />
                            <button onClick={saveEdit} class="text-accent text-xs hover:underline">save</button>
                            <button onClick={() => setEditingId(null)} class="text-gray-500 text-xs hover:underline">cancel</button>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                {/* Add child form */}
                <Show when={addingTo() === mod.id}>
                  <div class="ml-5 mt-1 flex gap-2">
                    <input
                      type="text"
                      value={childName()}
                      onInput={(e) => setChildName(e.currentTarget.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addChild(); if (e.key === 'Escape') setAddingTo(null) }}
                      placeholder="Sub-category name"
                      class="flex-1 bg-surface border border-border/30 rounded px-2 py-1 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/40"
                      autofocus
                    />
                    <button onClick={addChild} class="text-accent text-xs hover:underline">add</button>
                    <button onClick={() => setAddingTo(null)} class="text-gray-500 text-xs">cancel</button>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>

        {/* Add root category */}
        <div class="px-5 py-4 border-t border-border/30">
          <Show when={error()}>
            <p class="text-xs text-red-400 mb-2">{error()}</p>
          </Show>
          <div class="flex gap-2">
            <input
              type="text"
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addRoot() }}
              placeholder="New category name"
              class="flex-1 bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition"
            />
            <button
              onClick={addRoot}
              class="px-4 py-2 text-sm bg-accent/10 border border-accent/30 text-accent rounded-lg hover:bg-accent/20 transition"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
