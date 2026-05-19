import { createSignal, createEffect, Show, onMount, For } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { wikis, bspTree } from '../api/client'
import { getCredentials } from '../api/client'
import TagInput from '../components/TagInput'
import ImageDropZone from '../components/ImageDropZone'

interface BSPModule {
  id: number
  name: string
  slug: string
  icon: string
  bug_count: number
  wiki_count: number
  children?: BSPModule[]
}

export default function EditWikiPage() {
  const params = useParams()
  const navigate = useNavigate()
  const [saving, setSaving] = createSignal(false)
  const [errMsg, setErrMsg] = createSignal('')
  const [loaded, setLoaded] = createSignal(false)
  const [tags, setTags] = createSignal<string[]>([])
  const [bspModules, setBspModules] = createSignal<BSPModule[]>([])
  const [form, setForm] = createSignal({
    title: '',
    category: 'driver-dev',
    bsp_module_id: '' as string,
    content: '',
  })

  onMount(async () => {
    try {
      const data = await bspTree()
      setBspModules(data as BSPModule[])
    } catch {}
  })

  createEffect(() => {
    const id = params.id
    if (!id) return
    setErrMsg('')
    setLoaded(false)
    const auth = getCredentials() || ''
    fetch(`/api/wikis/${id}`, { headers: { Authorization: auth } })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data: any) => {
        setForm({
          title: data.title || '',
          category: data.category || 'driver-dev',
          bsp_module_id: data.bsp_module_id ? String(data.bsp_module_id) : '',
          content: data.content || '',
        })
        setTags(data.tags || [])
        setLoaded(true)
      })
      .catch((err) => { setErrMsg(err.message); setLoaded(true) })
  })

  const update = (key: string, value: string) => setForm({ ...form(), [key]: value })

  const save = async (e: Event) => {
    e.preventDefault()
    setSaving(true)
    try {
      const f = form()
      const payload: any = {
        title: f.title,
        category: f.category,
        content: f.content,
        tags: tags(),
      }
      if (f.bsp_module_id) {
        payload.bsp_module_id = Number(f.bsp_module_id)
      } else {
        payload.bsp_module_id = null
      }
      await wikis.update(Number(params.id), payload)
      navigate(`/wikis/${params.id}`)
    } catch (err: any) { alert('Save failed: ' + err?.message) } finally { setSaving(false) }
  }

  // Flatten BSP modules for select
  const flatModules = () => {
    const result: { id: number; name: string; indent: boolean }[] = []
    for (const mod of bspModules()) {
      result.push({ id: mod.id, name: mod.name, indent: false })
      if (mod.children) {
        for (const child of mod.children) {
          result.push({ id: child.id, name: child.name, indent: true })
        }
      }
    }
    return result
  }

  return (
    <Show when={errMsg()} fallback={
      <Show when={loaded()} fallback={
        <div class="text-center py-20 text-gray-500 font-mono">Loading...</div>
      }>
        <form onSubmit={save} class="h-[calc(100vh-7.5rem)] flex flex-col gap-0">
          {/* Sticky top bar: title + meta + actions */}
          <div class="shrink-0 bg-bg/80 backdrop-blur-sm border-b border-border/30 pb-4 pt-1 -mx-2 px-2 mb-0">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-xl font-semibold text-white">Edit Wiki</h2>
              <div class="flex gap-2">
                <button type="button" onClick={() => navigate(-1 as any)}
                  class="px-4 py-2 text-sm bg-surface border border-border/30 rounded-lg text-gray-400 hover:text-gray-200 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving()}
                  class="px-5 py-2 text-sm bg-secondary/10 border border-secondary/30 text-secondary rounded-lg font-medium hover:bg-secondary/20 transition-all disabled:opacity-50">
                  {saving() ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            <div class="flex gap-4 items-end">
              <div class="flex-1">
                <label class="block text-xs text-gray-500 mb-1 font-medium">Title</label>
                <input type="text" value={form().title} onInput={(e) => update('title', e.currentTarget.value)}
                  class="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-accent/40 transition" required />
              </div>
              <div class="w-36">
                <label class="block text-xs text-gray-500 mb-1 font-medium">Category</label>
                <select value={form().category} onChange={(e) => update('category', e.currentTarget.value)}
                  class="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:border-accent/40 transition">
                  <option value="driver-dev">Driver Dev</option>
                  <option value="kernel">Kernel</option>
                  <option value="hardware">Hardware</option>
                  <option value="tool">Tool</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div class="w-44">
                <label class="block text-xs text-gray-500 mb-1 font-medium">BSP Module</label>
                <select value={form().bsp_module_id} onChange={(e) => update('bsp_module_id', e.currentTarget.value)}
                  class="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:border-accent/40 transition">
                  <option value="">-- None --</option>
                  <For each={flatModules()}>
                    {(mod) => (
                      <option value={String(mod.id)}>{mod.indent ? `  └ ${mod.name}` : mod.name}</option>
                    )}
                  </For>
                </select>
              </div>
              <div class="w-56">
                <label class="block text-xs text-gray-500 mb-1 font-medium">Tags</label>
                <TagInput tags={tags()} onChange={setTags} placeholder="Enter to add" />
              </div>
            </div>
          </div>

          {/* Content editor — fills all remaining space */}
          <div class="flex-1 min-h-0 mt-4 flex flex-col">
            <ImageDropZone
              value={form().content}
              onInput={(val: string) => update('content', val)}
              articleType="wiki"
              articleId={Number(params.id)}
              placeholder="Write your article in Markdown..."
              class="w-full bg-surface border border-border/30 rounded-lg px-5 py-4 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition font-mono text-sm overflow-hidden"
            />
          </div>
        </form>
      </Show>
    }>
      <div class="text-center py-20">
        <p class="text-danger font-mono">{errMsg()}</p>
        <button onClick={() => navigate('/wikis')} class="mt-3 text-accent text-sm hover:underline">Back to Wikis</button>
      </div>
    </Show>
  )
}
