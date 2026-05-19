import { createSignal, onMount, Show, For } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { bugs, getCredentials } from '../api/client'
import MarkdownRenderer from '../components/MarkdownRenderer'
import WikiTOC from '../components/WikiTOC'
import { exportPdf } from '../components/PdfExport'

interface LinkedWiki {
  id: number
  title: string
  category: string
}

interface RelatedBug {
  id: number
  title: string
  severity: string
  soc: string
}

interface BugDetail {
  id: number
  title: string
  severity: string
  kernel_version: string
  soc: string
  tags: string[]
  bsp_module_path: string
  content: string
  created_at: string
  updated_at: string
  linked_wikis: LinkedWiki[]
  related_bugs: RelatedBug[]
}

export default function BugDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const [bug, setBug] = createSignal<BugDetail | null>(null)
  const [loading, setLoading] = createSignal(true)

  onMount(async () => {
    try {
      const data = await bugs.get(Number(params.id))
      setBug(data as BugDetail)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  })

  const severityColor = (s: string) => {
    const map: Record<string, string> = {
      critical: 'badge-critical',
      major: 'badge-major',
      minor: 'badge-minor',
      cosmetic: 'badge-cosmetic',
    }
    return map[s] || 'badge-minor'
  }

  const handleDelete = async () => {
    if (!confirm('Delete this bug record? This cannot be undone.')) return
    try {
      await bugs.delete(Number(params.id))
      navigate('/bugs')
    } catch (err) {
      alert('Delete failed: ' + (err as Error).message)
    }
  }

  return (
    <Show when={!loading()} fallback={
      <div class="text-center py-20 text-gray-500 font-mono text-sm">Loading...</div>
    }>
      <Show when={bug()} fallback={
        <div class="text-center py-20 text-gray-500">Bug not found</div>
      }>
        {(() => {
          const b = bug()!
          const hasTOC = b.content?.split('\n').filter(l => /^#{2,6}\s/.test(l)).length > 2

          return (
            <div class="w-full" id="bug-content">
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
                    onClick={() => navigate(`/bugs/${b.id}/edit`)}
                    class="px-3 py-1.5 text-xs bg-surface border border-border/30 rounded-lg text-gray-400 hover:text-accent transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => exportPdf({
                      title: b.title,
                      meta: `${b.severity}${b.soc ? ' | ' + b.soc : ''}${b.tags?.length ? ' | ' + b.tags.join(', ') : ''} | ${new Date(b.created_at).toLocaleDateString()}`,
                      contentId: 'bug-md-content',
                      filename: `bug-${params.id}.pdf`
                    })}
                    class="px-3 py-1.5 text-xs bg-accent/10 border border-accent/20 rounded-lg text-accent hover:bg-accent/20 transition"
                  >
                    Export PDF
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
              <div class="mb-8">
                <h1 class="text-2xl font-bold text-white mb-3">{b.title}</h1>
                <div class="flex flex-wrap items-center gap-3">
                  <span class={`px-2.5 py-1 text-xs font-mono font-medium rounded border ${severityColor(b.severity)}`}>
                    {b.severity}
                  </span>
                  <Show when={b.bsp_module_path}>
                    <span class="text-sm text-gray-400 font-mono">{b.bsp_module_path}</span>
                  </Show>
                  <Show when={b.kernel_version}>
                    <span class="text-sm text-gray-500">Kernel {b.kernel_version}</span>
                  </Show>
                  <Show when={b.soc}>
                    <span class="text-sm text-secondary/60 font-mono">{b.soc}</span>
                  </Show>
                  <Show when={b.tags?.length > 0}>
                    <For each={b.tags}>
                      {(tag) => (
                        <span class="px-2 py-0.5 text-[10px] bg-surface text-gray-400 rounded font-mono border border-border/20">#{tag}</span>
                      )}
                    </For>
                  </Show>
                </div>
                <div class="text-xs text-gray-600 font-mono mt-2">
                  Created: {new Date(b.created_at).toLocaleString()}
                </div>
              </div>

              {/* Content + TOC layout */}
              <div class="flex gap-6">
                {/* Main content */}
                <div class="flex-1 min-w-0">
                  <Show when={b.content}>
                    <div class="bg-card border border-border/30 rounded-xl p-6 mb-6">
                      <div id="bug-md-content"><MarkdownRenderer content={b.content} /></div>
                    </div>
                  </Show>

                  {/* Related content */}
                  <Show when={(b.linked_wikis?.length || 0) > 0 || (b.related_bugs?.length || 0) > 0}>
                    <div class="grid grid-cols-2 gap-4">
                      <Show when={b.linked_wikis?.length > 0}>
                        <section class="bg-card border border-border/30 rounded-xl p-4">
                          <h3 class="text-sm font-medium text-secondary mb-3">Linked Wiki</h3>
                          <div class="space-y-2">
                            <For each={b.linked_wikis}>
                              {(w) => (
                                <div
                                  class="text-sm text-gray-400 hover:text-accent cursor-pointer transition truncate"
                                  onClick={() => navigate(`/wikis/${w.id}`)}
                                >
                                  [[{w.title}]]
                                </div>
                              )}
                            </For>
                          </div>
                        </section>
                      </Show>
                      <Show when={b.related_bugs?.length > 0}>
                        <section class="bg-card border border-border/30 rounded-xl p-4">
                          <h3 class="text-sm font-medium text-accent mb-3">Similar Bugs</h3>
                          <div class="space-y-2">
                            <For each={b.related_bugs}>
                              {(rb) => (
                                <div
                                  class="text-sm text-gray-400 hover:text-accent cursor-pointer transition"
                                  onClick={() => navigate(`/bugs/${rb.id}`)}
                                >
                                  <span class="text-gray-600 font-mono">#{rb.id}</span> {rb.title}
                                </div>
                              )}
                            </For>
                          </div>
                        </section>
                      </Show>
                    </div>
                  </Show>
                </div>

                {/* Floating TOC */}
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
