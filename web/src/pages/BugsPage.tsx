import { createSignal, onMount, For, Show } from 'solid-js'
import { useNavigate, useSearchParams } from '@solidjs/router'
import { bugs } from '../api/client'

interface Bug {
  id: number
  title: string
  severity: string
  soc: string
  bsp_module_name: string
  bsp_module_path: string
  tags: string[]
  created_at: string
  background: string
}

export default function BugsPage() {
  const [bugList, setBugList] = createSignal<Bug[]>([])
  const [total, setTotal] = createSignal(0)
  const [page, setPage] = createSignal(1)
  const [loading, setLoading] = createSignal(true)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const fetchBugs = (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(p))
    params.set('page_size', '20')
    if (searchParams.module) params.set('module', searchParams.module)
    if (searchParams.severity) params.set('severity', searchParams.severity)
    if (searchParams.q) params.set('q', searchParams.q)

    bugs.list(params.toString())
      .then((res: any) => {
        setBugList(res.data || [])
        setTotal(res.total || 0)
        setPage(p)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  // Create a reactive effect on searchParams
  onMount(() => fetchBugs(1))

  // Re-fetch when searchParams change (module filter from sidebar)
  const prevModule = () => searchParams.module
  const prevQ = () => searchParams.q
  let lastModule: string | undefined
  let lastQ: string | undefined

  // Check every tick for param changes
  const interval = setInterval(() => {
    const m = prevModule()
    const q = prevQ()
    if (m !== lastModule || q !== lastQ) {
      lastModule = m
      lastQ = q
      fetchBugs(1)
    }
  }, 300)
  // Clean up on page destroy (SolidJS doesn't have onUnmount, use onCleanup)
  import('solid-js').then(({ onCleanup }) => onCleanup(() => clearInterval(interval)))

  const severityColor = (s: string) => {
    const map: Record<string, string> = {
      critical: 'badge-critical',
      major: 'badge-major',
      minor: 'badge-minor',
      cosmetic: 'badge-cosmetic',
    }
    return map[s] || 'badge-minor'
  }

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-semibold text-white">
            Bug Records
            <Show when={searchParams.module}>
              <span class="text-accent ml-2 text-base font-normal">/ Filtered</span>
            </Show>
          </h2>
          <p class="text-sm text-gray-500 mt-1">{total()} records</p>
        </div>
        <Show when={searchParams.module || searchParams.q}>
          <button
            onClick={() => navigate('/bugs')}
            class="text-xs text-gray-500 hover:text-accent transition border border-border/30 px-3 py-1.5 rounded-lg"
          >
            Clear filter
          </button>
        </Show>
      </div>

      <Show when={!loading()} fallback={
        <div class="text-center py-20 text-gray-500 font-mono text-sm">Loading...</div>
      }>
        <Show when={bugList().length === 0} fallback={
          <div class="space-y-3">
            <For each={bugList()}>
              {(bug) => (
                <div
                  class="bg-card border border-border/30 rounded-xl p-5 card-glow cursor-pointer"
                  onClick={() => navigate(`/bugs/${bug.id}`)}
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1.5">
                        <span class={`px-2 py-0.5 text-[11px] font-mono font-medium rounded border ${severityColor(bug.severity)}`}>
                          {bug.severity}
                        </span>
                        <Show when={bug.bsp_module_path}>
                          <span class="text-sm text-gray-500 font-mono">{bug.bsp_module_path}</span>
                        </Show>
                        <Show when={bug.soc}>
                          <span class="text-sm text-secondary/60 font-mono">{bug.soc}</span>
                        </Show>
                      </div>
                      <h3 class="text-white font-medium text-[15px]">{bug.title}</h3>
                      <Show when={bug.tags?.length > 0}>
                        <div class="flex gap-1 mt-2">
                          <For each={bug.tags?.slice(0, 5)}>
                            {(tag) => (
                              <span class="px-1.5 py-0.5 text-[11px] bg-surface text-gray-400 rounded font-mono">{tag}</span>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                    <div class="text-sm text-gray-600 font-mono shrink-0">
                      {new Date(bug.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        }>
          <div class="text-center py-20">
            <p class="text-gray-500 font-mono">No bugs found</p>
            <button
              onClick={() => navigate('/bugs/new')}
              class="mt-3 text-accent text-sm hover:underline"
            >
              Create your first bug record
            </button>
          </div>
        </Show>

        <Show when={total() > 20}>
          <div class="flex justify-center gap-2 mt-6">
            <Show when={page() > 1}>
              <button
                onClick={() => fetchBugs(page() - 1)}
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
                onClick={() => fetchBugs(page() + 1)}
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
