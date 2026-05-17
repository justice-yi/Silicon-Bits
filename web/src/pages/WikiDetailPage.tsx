import { createSignal, onMount, Show, For } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { wikis } from '../api/client'
import { getCredentials } from '../api/client'
import MarkdownRenderer from '../components/MarkdownRenderer'
import WikiTOC from '../components/WikiTOC'

interface BugBrief {
  id: number
  title: string
  severity: string
  soc: string
}

interface WikiDetail {
  id: number
  title: string
  category: string
  tags: string[]
  content: string
  source: string
  created_at: string
  updated_at: string
  linked_bugs: BugBrief[]
}

export default function WikiDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const [wiki, setWiki] = createSignal<WikiDetail | null>(null)
  const [loading, setLoading] = createSignal(true)

  onMount(async () => {
    const auth = getCredentials() || ''
    try {
      const res = await fetch(`/api/wikis/${params.id}`, { headers: { Authorization: auth } })
      if (!res.ok) throw new Error('Not found')
      const data = await res.json()
      setWiki(data as WikiDetail)
    } catch {
      setWiki(null)
    } finally {
      setLoading(false)
    }
  })

  const handleExport = async () => {
    const auth = getCredentials() || ''
    const res = await fetch(`/api/wikis/${params.id}/export?format=md`, {
      headers: { Authorization: auth }
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `wiki-${params.id}.md`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this wiki article and all its images? This cannot be undone.')) return
    try {
      await wikis.delete(Number(params.id))
      navigate('/wikis')
    } catch (err) {
      alert('Delete failed: ' + (err as Error).message)
    }
  }

  const categoryLabel: Record<string, string> = {
    'driver-dev': 'Driver Dev',
    'kernel': 'Kernel',
    'hardware': 'Hardware',
    'tool': 'Tool',
    'other': 'Other',
  }

  return (
    <Show when={!loading()} fallback={
      <div class="text-center py-20 text-gray-500 font-mono">Loading...</div>
    }>
      <Show when={wiki()} fallback={
        <div class="text-center py-20 text-gray-500">Article not found</div>
      }>
        {(() => {
          const w = wiki()!
          const hasTOC = w.content.split('\n').filter(l => /^#{2,6}\s/.test(l)).length > 2

          // Compute imageBasePath from file_path: "data/wiki/09_UART/01_xxx.md" → "/wiki/09_UART"
          let imgBase = '/wiki'
          if (w.file_path) {
            const parts = w.file_path.replace(/\\/g, '/').split('/')
            // parts: ["data", "wiki", "09_UART", "01_xxx.md"]
            // take everything after "wiki" except the .md filename
            const wikiIdx = parts.indexOf('wiki')
            if (wikiIdx >= 0 && parts.length > wikiIdx + 2) {
              imgBase = '/wiki/' + parts.slice(wikiIdx + 1, -1).join('/')
            }
          }

          return (
            <div class="w-full">
              {/* Header */}
              <div class="flex items-center justify-between mb-6">
                <button
                  onClick={() => navigate(-1 as any)}
                  class="text-sm text-gray-500 hover:text-accent transition"
                >
                  &larr; Back
                </button>
                <div class="flex gap-2">
                  <button
                    onClick={() => navigate(`/wikis/${params.id}/edit`)}
                    class="px-3 py-1.5 text-xs bg-surface border border-border/30 rounded-lg text-gray-400 hover:text-accent transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleExport}
                    class="px-3 py-1.5 text-xs bg-secondary/10 border border-secondary/20 rounded-lg text-secondary hover:bg-secondary/20 transition"
                  >
                    Export .md
                  </button>
                  <button
                    onClick={handleDelete}
                    class="px-3 py-1.5 text-xs bg-danger/10 border border-danger/20 rounded-lg text-danger hover:bg-danger/20 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Title & Meta */}
              <div class="mb-6">
                <h1 class="text-2xl font-bold text-white mb-3">{w.title}</h1>
                <div class="flex flex-wrap items-center gap-3">
                  <span class="px-2.5 py-1 text-xs bg-secondary/10 text-secondary border border-secondary/20 rounded font-mono">
                    {categoryLabel[w.category] || w.category}
                  </span>
                  <Show when={w.source === 'file' || w.source === 'original'}>
                    <span class="text-[10px] text-gray-600 bg-surface px-1.5 py-0.5 rounded">{w.source}</span>
                  </Show>
                  <Show when={w.tags?.length > 0}>
                    <For each={w.tags}>
                      {(tag) => (
                        <span class="px-2 py-0.5 text-[10px] bg-surface text-gray-400 rounded font-mono border border-border/20">#{tag}</span>
                      )}
                    </For>
                  </Show>
                </div>
                <div class="text-xs text-gray-600 font-mono mt-2">
                  Created: {new Date(w.created_at).toLocaleString()}
                </div>
              </div>

              {/* Content + TOC layout */}
              <div class="flex gap-6">
                {/* Main content */}
                <div class="flex-1 min-w-0">
                  <div class="bg-card border border-border/30 rounded-xl p-6 mb-6">
                    <MarkdownRenderer content={w.content} imageBasePath={imgBase} />
                  </div>

                  {/* Linked Bugs */}
                  <Show when={w.linked_bugs?.length > 0}>
                    <section class="bg-card border border-border/30 rounded-xl p-4">
                      <h3 class="text-sm font-medium text-accent mb-3">Linked Bugs</h3>
                      <div class="space-y-2">
                        <For each={w.linked_bugs}>
                          {(b) => (
                            <div
                              class="text-sm text-gray-400 hover:text-accent cursor-pointer transition"
                              onClick={() => navigate(`/bugs/${b.id}`)}
                            >
                              <span class="text-gray-600 font-mono">#{b.id}</span> {b.title}
                            </div>
                          )}
                        </For>
                      </div>
                    </section>
                  </Show>
                </div>

                {/* Floating TOC sidebar */}
                <Show when={hasTOC}>
                  <WikiTOC />
                </Show>
              </div>
            </div>
          )
        })()}
      </Show>
    </Show>
  )
}
