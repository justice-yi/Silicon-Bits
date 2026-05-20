import { createSignal, onMount, createEffect, For, Show } from 'solid-js'
import { useNavigate, useSearchParams } from '@solidjs/router'
import { wikis } from '../api/client'
import { request } from '../api/client'

interface Wiki {
  id: number
  title: string
  category: string
  bsp_module_id: number | null
  bsp_module_name: string
  tags: string[]
  content: string
  source: string
  created_at: string
}

export default function WikisPage() {
  const [wikiList, setWikiList] = createSignal<Wiki[]>([])
  const [total, setTotal] = createSignal(0)
  const [page, setPage] = createSignal(1)
  const [loading, setLoading] = createSignal(true)
  const [draggingId, setDraggingId] = createSignal(0)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const fetchWikis = (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(p))
    params.set('page_size', '20')
    if (searchParams.category) params.set('category', searchParams.category)
    if (searchParams.module) params.set('module', searchParams.module)
    if (searchParams.q) params.set('q', searchParams.q)

    wikis.list(params.toString())
      .then((res: any) => {
        setWikiList(res.data || [])
        setTotal(res.total || 0)
        setPage(p)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  onMount(() => fetchWikis(1))

  // Re-fetch when search params change (category/module filter from sidebar)
  createEffect(() => {
    const cat = searchParams.category
    const mod = searchParams.module
    const q = searchParams.q
    fetchWikis(1)
  })

  const categoryLabel: Record<string, string> = {
    'driver-dev': 'Driver Dev',
    'kernel': 'Kernel',
    'hardware': 'Hardware',
    'tool': 'Tool',
    'other': 'Other',
  }

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-semibold text-white">
            Wiki
            <Show when={searchParams.module}>
              <span class="text-secondary ml-2 text-base font-normal">/ Filtered</span>
            </Show>
            <Show when={searchParams.category && !searchParams.module}>
              <span class="text-secondary ml-2 text-base font-normal">/ {categoryLabel[searchParams.category] || searchParams.category}</span>
            </Show>
          </h2>
          <p class="text-sm text-gray-500 mt-1">{total()} articles</p>
        </div>
        <div class="flex items-center gap-2">
          <Show when={searchParams.category || searchParams.module || searchParams.q}>
            <button
              onClick={() => navigate('/wikis')}
              class="text-xs text-gray-500 hover:text-accent transition border border-border/30 px-3 py-1.5 rounded-lg"
            >
              Clear filter
            </button>
          </Show>
          <button
            onClick={() => { request('/wikis/scan', { method: 'POST' }).then(() => fetchWikis(1)) }}
            class="px-3 py-1.5 text-xs bg-surface border border-border/30 rounded-lg text-gray-400 hover:text-accent transition"
          >
            Scan .md Files
          </button>
        </div>
      </div>

      <Show when={!loading()} fallback={
        <div class="text-center py-20 text-gray-500 font-mono text-sm">Loading...</div>
      }>
        <Show when={wikiList().length > 0} fallback={
          <div class="text-center py-20">
            <p class="text-gray-500 font-mono">No wiki articles</p>
            <button
              onClick={() => navigate('/wikis/new')}
              class="mt-3 text-secondary text-sm hover:underline"
            >
              Create your first article
            </button>
          </div>
        }>
          <div class="grid grid-cols-2 gap-3">
            <For each={wikiList()}>
              {(wiki) => (
                <div
                  class="bg-card border border-border/30 rounded-xl p-4 card-glow cursor-pointer"
                  classList={{ 'opacity-50 ring-2 ring-accent/50': draggingId() === wiki.id }}
                  draggable={true}
                  onClick={() => navigate(`/wikis/${wiki.id}`)}
                  onDragStart={(e) => {
                    setDraggingId(wiki.id)
                    e.dataTransfer!.setData('wiki-id', String(wiki.id))
                    e.dataTransfer!.effectAllowed = 'move'
                  }}
                  onDragEnd={() => setDraggingId(0)}
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span class="px-2 py-0.5 text-[10px] bg-secondary/10 text-secondary border border-secondary/20 rounded font-mono">
                      {categoryLabel[wiki.category] || wiki.category}
                    </span>
                    <Show when={wiki.bsp_module_name}>
                      <span class="px-2 py-0.5 text-[10px] bg-accent/10 text-accent border border-accent/20 rounded font-mono">
                        {wiki.bsp_module_name}
                      </span>
                    </Show>
                    <Show when={wiki.source === 'notion-import'}>
                      <span class="px-1.5 py-0.5 text-[10px] bg-surface text-gray-500 rounded">Notion</span>
                    </Show>
                  </div>
                  <h3 class="text-white font-medium mb-1 truncate">{wiki.title}</h3>
                  <p class="text-sm text-gray-500 line-clamp-2">{wiki.content?.substring(0, 120)}</p>
                  <Show when={wiki.tags?.length > 0}>
                    <div class="flex gap-1 mt-2">
                      <For each={wiki.tags?.slice(0, 3)}>
                        {(tag) => (
                          <span class="px-1.5 py-0.5 text-[10px] bg-surface text-gray-400 rounded font-mono">{tag}</span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={total() > 20}>
          <div class="flex justify-center gap-2 mt-6">
            <Show when={page() > 1}>
              <button
                onClick={() => fetchWikis(page() - 1)}
                class="px-3 py-1.5 text-sm bg-surface border border-border/30 rounded-lg text-gray-400 hover:text-accent transition"
              >
                Prev
              </button>
            </Show>
            <span class="px-3 py-1.5 text-sm text-gray-500 font-mono">
              {page()} / {Math.ceil(total() / 20)}
            </span>
            <Show when={page() * 20 < total()}>
              <button
                onClick={() => fetchWikis(page() + 1)}
                class="px-3 py-1.5 text-sm bg-surface border border-border/30 rounded-lg text-gray-400 hover:text-accent transition"
              >
                Next
              </button>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  )
}
