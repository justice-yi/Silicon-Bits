import { createSignal, onMount, For, Show } from 'solid-js'
import { useNavigate, useLocation } from '@solidjs/router'
import { bspTree, wikis } from '../api/client'
import CategoryManager from './CategoryManager'

interface BSPModule {
  id: number
  name: string
  slug: string
  icon: string
  bug_count: number
  wiki_count: number
  children?: BSPModule[]
}

export default function Sidebar(props: { onNavigate?: () => void }) {
  const [tree, setTree] = createSignal<BSPModule[]>([])
  const [expanded, setExpanded] = createSignal<Set<number>>(new Set())
  const [showManager, setShowManager] = createSignal(false)
  const [dropTargetId, setDropTargetId] = createSignal(0)
  const dragCounters = new Map<number, number>()
  const navigate = useNavigate()
  const location = useLocation()

  const loadTree = async () => {
    try {
      const data = await bspTree()
      setTree(data as BSPModule[])
    } catch {}
  }

  onMount(loadTree)

  const toggleExpand = (id: number) => {
    const s = new Set(expanded())
    if (s.has(id)) { s.delete(id) } else { s.add(id) }
    setExpanded(s)
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <>
      <aside class="w-60 border-r border-border/50 bg-card flex flex-col shrink-0 overflow-y-auto">
        {/* Nav links */}
        <nav class="p-3 space-y-0.5">
          <div
            class={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
              isActive('/') || isActive('/bugs') ? 'bg-accent/10 text-accent' : 'text-gray-400 hover:bg-surface hover:text-gray-200'
            }`}
            onClick={() => { navigate('/bugs'); props.onNavigate?.() }}
          >
            <span>📋</span>
            <span class="font-medium">Bugs</span>
          </div>
          <div
            class={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
              isActive('/wikis') ? 'bg-secondary/10 text-secondary' : 'text-gray-400 hover:bg-surface hover:text-gray-200'
            }`}
            onClick={() => { navigate('/wikis'); props.onNavigate?.() }}
          >
            <span>📚</span>
            <span class="font-medium">Wiki</span>
          </div>
        </nav>

        {/* BSP Module Tree — Wiki categories */}
        <div class="px-3 pt-3 border-t border-border/30 flex-1">
          <div class="flex items-center justify-between px-3 mb-2">
            <span class="text-xs uppercase tracking-wider text-gray-500 font-semibold">Categories</span>
            <button
              onClick={() => setShowManager(true)}
              class="text-gray-600 hover:text-accent transition text-xs"
              title="Manage categories"
            >
              +/-
            </button>
          </div>
          <For each={tree()}>
            {(mod) => (
              <div>
                <div
                  class="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all text-accent-dim hover:bg-accent/10 hover:text-accent group"
                  onClick={() => toggleExpand(mod.id)}
                >
                  <span class="text-xs text-accent/50 transition-transform" classList={{ 'rotate-90': expanded().has(mod.id) }}>▶</span>
                  <span class="flex-1 truncate font-medium">{mod.name}</span>
                  <Show when={mod.wiki_count > 0}>
                    <span class="text-xs text-accent/50 font-mono">{mod.wiki_count}</span>
                  </Show>
                </div>
                <Show when={expanded().has(mod.id) && mod.children}>
                  <div class="ml-6">
                    <For each={mod.children}>
                      {(child) => (
                        <div
                          class="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all text-sm text-secondary/70 hover:text-secondary hover:bg-secondary/10"
                          classList={{ 'bg-accent/20 text-accent ring-2 ring-accent shadow-[0_0_12px_var(--color-glow)]': dropTargetId() === child.id }}
                          onClick={() => { navigate(`/wikis?module=${child.id}`); props.onNavigate?.() }}
                          onDragEnter={(e) => {
                            e.preventDefault()
                            dragCounters.set(child.id, (dragCounters.get(child.id) || 0) + 1)
                            setDropTargetId(child.id)
                          }}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'move' }}
                          onDragLeave={() => {
                            const c = (dragCounters.get(child.id) || 1) - 1
                            dragCounters.set(child.id, c)
                            if (c <= 0) { dragCounters.delete(child.id); setDropTargetId(0) }
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            dragCounters.delete(child.id)
                            setDropTargetId(0)
                            const wikiId = Number(e.dataTransfer!.getData('wiki-id'))
                            if (wikiId) {
                              wikis.update(wikiId, { bsp_module_id: child.id })
                                .then(() => loadTree())
                                .catch(console.error)
                            }
                          }}
                        >
                          <span class="flex-1 truncate">{child.name}</span>
                          <Show when={child.wiki_count > 0}>
                            <span class="text-xs font-mono text-secondary/40">{child.wiki_count}</span>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>

        {/* Wiki categories (flat) */}
        <div class="px-3 pt-3 border-t border-border/30">
          <div class="text-xs uppercase tracking-wider text-gray-500 px-3 mb-2 font-semibold">Wiki Types</div>
          {['driver-dev', 'kernel', 'hardware', 'tool', 'other'].map(cat => (
            <div
              class="px-3 py-1.5 rounded-md cursor-pointer transition-all text-sm text-secondary/70 hover:text-secondary hover:bg-secondary/10"
              onClick={() => { navigate(`/wikis?category=${cat}`); props.onNavigate?.() }}
            >
              {cat}
            </div>
          ))}
        </div>
      </aside>

      <Show when={showManager()}>
        <CategoryManager onClose={() => { setShowManager(false); loadTree() }} />
      </Show>
    </>
  )
}
