import { createSignal, onMount, For, Show } from 'solid-js'
import { useNavigate, useLocation } from '@solidjs/router'
import { bspTree } from '../api/client'
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
                  class="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all text-gray-300 hover:bg-surface hover:text-white group"
                  onClick={() => toggleExpand(mod.id)}
                >
                  <span class="text-xs text-gray-500 transition-transform" classList={{ 'rotate-90': expanded().has(mod.id) }}>▶</span>
                  <span class="flex-1 truncate">{mod.name}</span>
                  <Show when={mod.wiki_count > 0}>
                    <span class="text-xs text-gray-500 font-mono">{mod.wiki_count}</span>
                  </Show>
                </div>
                <Show when={expanded().has(mod.id) && mod.children}>
                  <div class="ml-6">
                    <For each={mod.children}>
                      {(child) => (
                        <div
                          class="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all text-sm text-gray-500 hover:text-secondary hover:bg-secondary/5"
                          onClick={() => { navigate(`/wikis?module=${child.id}`); props.onNavigate?.() }}
                        >
                          <span class="flex-1 truncate">{child.name}</span>
                          <Show when={child.wiki_count > 0}>
                            <span class="text-xs font-mono text-gray-600">{child.wiki_count}</span>
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
              class="px-3 py-1.5 rounded-md cursor-pointer transition-all text-sm text-gray-500 hover:text-secondary hover:bg-secondary/5"
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
