import { createSignal, createEffect, For, Show } from 'solid-js'
import { useNavigate, useSearchParams } from '@solidjs/router'
import { search } from '../api/client'

interface SearchResult {
  bugs?: any[]
  wikis?: any[]
}

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [results, setResults] = createSignal<SearchResult>({})
  const [loading, setLoading] = createSignal(true)
  const q = () => searchParams.q || ''

  // React to q changes: navigating /search?q=a → /search?q=b does NOT remount
  // this component, so the search must live in an effect, not onMount.
  // seq guards against a slow earlier response overwriting a newer one.
  let seq = 0
  createEffect(() => {
    const query = q()
    const my = ++seq
    if (!query) {
      setResults({})
      setLoading(false)
      return
    }
    setLoading(true)
    search(query)
      .then((data) => {
        if (my === seq) setResults(data as SearchResult)
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (my === seq) setLoading(false)
      })
  })

  return (
    <div>
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-white">
          Search: <span class="text-accent font-mono">{q()}</span>
        </h2>
      </div>

      <Show when={!loading()} fallback={
        <div class="text-center py-20 text-gray-500 font-mono text-sm">Searching...</div>
      }>
        <Show when={q()} fallback={
          <div class="text-center py-20 text-gray-500 font-mono">Enter a search query</div>
        }>
          {/* Bug results */}
          <Show when={results().bugs?.length > 0}>
            <div class="mb-8">
              <h3 class="text-sm font-medium text-accent mb-3 flex items-center gap-2">
                <span>📋</span> Bugs ({results().bugs?.length})
              </h3>
              <div class="space-y-2">
                <For each={results().bugs}>
                  {(bug: any) => (
                    <div
                      class="bg-card border border-border/30 rounded-lg p-3 card-glow cursor-pointer"
                      onClick={() => navigate(`/bugs/${bug.id}`)}
                    >
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-gray-600 font-mono text-xs">#{bug.id}</span>
                        <span class="text-white text-sm">{bug.title}</span>
                      </div>
                      <p class="text-xs text-gray-500 line-clamp-1">{bug.context}</p>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Wiki results */}
          <Show when={results().wikis?.length > 0}>
            <div class="mb-8">
              <h3 class="text-sm font-medium text-secondary mb-3 flex items-center gap-2">
                <span>📚</span> Wiki ({results().wikis?.length})
              </h3>
              <div class="space-y-2">
                <For each={results().wikis}>
                  {(wiki: any) => (
                    <div
                      class="bg-card border border-border/30 rounded-lg p-3 card-glow cursor-pointer"
                      onClick={() => navigate(`/wikis/${wiki.id}`)}
                    >
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-gray-600 font-mono text-xs">#{wiki.id}</span>
                        <span class="text-white text-sm">{wiki.title}</span>
                        <span class="px-1.5 py-0.5 text-[10px] bg-secondary/10 text-secondary rounded">{wiki.category}</span>
                      </div>
                      <p class="text-xs text-gray-500 line-clamp-1">{wiki.context}</p>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* No results */}
          <Show when={!results().bugs?.length && !results().wikis?.length}>
            <div class="text-center py-20 text-gray-500 font-mono">
              No results found for "{q()}"
            </div>
          </Show>
        </Show>
      </Show>
    </div>
  )
}
