import { createSignal, createEffect, For, Show } from 'solid-js'
import { useParams, useNavigate } from '@solidjs/router'
import { bugs, bspTree } from '../api/client'
import { getCredentials } from '../api/client'
import TagInput from '../components/TagInput'
import ImageDropZone from '../components/ImageDropZone'

interface BSPModule {
  id: number
  name: string
  children?: BSPModule[]
}

export default function EditBugPage() {
  const params = useParams()
  const navigate = useNavigate()
  const [modules, setModules] = createSignal<BSPModule[]>([])
  const [saving, setSaving] = createSignal(false)
  const [errMsg, setErrMsg] = createSignal('')
  const [loaded, setLoaded] = createSignal(false)
  const [tags, setTags] = createSignal<string[]>([])
  const [form, setForm] = createSignal({
    title: '',
    bsp_module_id: '' as string,
    severity: 'major',
    kernel_version: '',
    soc: '',
    content: '',
  })

  createEffect(() => {
    const id = params.id
    if (!id) return
    setErrMsg('')
    setLoaded(false)
    const auth = getCredentials() || ''
    Promise.all([
      fetch(`/api/bugs/${id}`, { headers: { Authorization: auth } }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
      fetch('/api/bsp/tree', { headers: { Authorization: auth } }).then(r => r.json()),
    ])
      .then(([data, tree]: any[]) => {
        setModules(tree as BSPModule[])
        setForm({
          title: data.title || '',
          bsp_module_id: data.bsp_module_id ? String(data.bsp_module_id) : '',
          severity: data.severity || 'major',
          kernel_version: data.kernel_version || '',
          soc: data.soc || '',
          content: data.content || '',
        })
        setTags(data.tags || [])
        setLoaded(true)
      })
      .catch((err) => { setErrMsg(err.message || 'Failed to load'); setLoaded(true) })
  })

  const update = (key: string, value: string) => setForm({ ...form(), [key]: value })

  const save = async (e: Event) => {
    e.preventDefault()
    setSaving(true)
    try {
      const f = form()
      const data: any = { title: f.title, severity: f.severity, content: f.content, tags: tags() }
      if (f.bsp_module_id) data.bsp_module_id = Number(f.bsp_module_id)
      if (f.kernel_version) data.kernel_version = f.kernel_version
      if (f.soc) data.soc = f.soc
      await bugs.update(Number(params.id), data)
      navigate(`/bugs/${params.id}`)
    } catch (err: any) { alert('Save failed: ' + (err?.message || 'unknown error')) }
    finally { setSaving(false) }
  }

  return (
    <Show when={errMsg()} fallback={
      <Show when={loaded()} fallback={
        <div class="text-center py-20 text-gray-500 font-mono">Loading...</div>
      }>
        <div class="w-full">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-white">Edit Bug</h2>
            <button onClick={() => navigate(-1 as any)} class="text-sm text-gray-500 hover:text-accent transition">Cancel</button>
          </div>
          <form onSubmit={save} class="space-y-5">
            <div>
              <label class="block text-sm text-gray-400 mb-1.5 font-medium">Title *</label>
              <input type="text" value={form().title} onInput={(e) => update('title', e.currentTarget.value)}
                class="w-full bg-surface border border-border/30 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition" required />
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1.5 font-medium">BSP Module</label>
                <select value={form().bsp_module_id} onChange={(e) => update('bsp_module_id', e.currentTarget.value)}
                  class="w-full bg-surface border border-border/30 rounded-lg px-3 py-3 text-gray-300 focus:outline-none focus:border-accent/40 transition">
                  <option value="">-- None --</option>
                  <For each={modules()}>{(mod) => (
                    <optgroup label={mod.name}>
                      <For each={mod.children || []}>{(child) => <option value={child.id}>{child.name}</option>}</For>
                    </optgroup>
                  )}</For>
                </select>
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1.5 font-medium">Severity</label>
                <select value={form().severity} onChange={(e) => update('severity', e.currentTarget.value)}
                  class="w-full bg-surface border border-border/30 rounded-lg px-3 py-3 text-gray-300 focus:outline-none focus:border-accent/40 transition">
                  <option value="critical">Critical</option><option value="major">Major</option><option value="minor">Minor</option><option value="cosmetic">Cosmetic</option>
                </select>
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1.5 font-medium">Kernel Version</label>
                <input type="text" value={form().kernel_version} onInput={(e) => update('kernel_version', e.currentTarget.value)}
                  class="w-full bg-surface border border-border/30 rounded-lg px-3 py-3 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1.5 font-medium">SoC</label>
                <input type="text" value={form().soc} onInput={(e) => update('soc', e.currentTarget.value)}
                  class="w-full bg-surface border border-border/30 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition" />
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1.5 font-medium">Tags</label>
                <TagInput tags={tags()} onChange={setTags} placeholder="Press Enter to add tag" />
              </div>
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5 font-medium">Content * (Markdown)</label>
              <ImageDropZone
                value={form().content} onInput={(val: string) => update('content', val)}
                articleType="bug" articleId={Number(params.id)}
                class="w-full bg-surface border border-border/30 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition font-mono text-sm overflow-hidden"
              />
              <div class="text-xs text-gray-600 mt-1">Paste or drag images directly into the editor</div>
            </div>
            <div class="flex gap-3 pt-2">
              <button type="submit" disabled={saving()}
                class="px-6 py-2.5 bg-accent/10 border border-accent/30 text-accent rounded-lg font-medium hover:bg-accent/20 transition-all disabled:opacity-50">
                {saving() ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => navigate(-1 as any)}
                class="px-6 py-2.5 bg-surface border border-border/30 rounded-lg text-gray-400 hover:text-gray-200 transition">Cancel</button>
            </div>
          </form>
        </div>
      </Show>
    }>
      <div class="text-center py-20">
        <p class="text-danger font-mono">{errMsg()}</p>
        <button onClick={() => navigate('/bugs')} class="mt-3 text-accent text-sm hover:underline">Back to Bugs</button>
      </div>
    </Show>
  )
}
