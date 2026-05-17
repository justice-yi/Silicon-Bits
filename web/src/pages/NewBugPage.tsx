import { createSignal, onMount, For } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { bugs, bspTree } from '../api/client'
import TagInput from '../components/TagInput'
import ImageDropZone from '../components/ImageDropZone'

interface BSPModule {
  id: number
  name: string
  children?: BSPModule[]
}

const defaultContent = `## Background


## Debug Process


## Root Cause Analysis


## Solution

`

export default function NewBugPage() {
  const navigate = useNavigate()
  const [modules, setModules] = createSignal<BSPModule[]>([])
  const [saving, setSaving] = createSignal(false)
  const [tags, setTags] = createSignal<string[]>([])
  // bugId starts null; auto-created on first image upload
  const [bugId, setBugId] = createSignal<number | null>(null)

  const [form, setForm] = createSignal({
    title: '',
    bsp_module_id: '' as string,
    severity: 'major',
    kernel_version: '',
    soc: '',
    content: defaultContent,
  })

  onMount(async () => {
    try {
      const data = await bspTree()
      setModules(data as BSPModule[])
    } catch {}
  })

  const update = (key: string, value: string) => {
    setForm({ ...form(), [key]: value })
  }

  // Auto-create bug (draft) so we get an ID for image uploads
  const ensureBugCreated = async (): Promise<number> => {
    const existing = bugId()
    if (existing) return existing

    const f = form()
    if (!f.title) {
      // Auto-generate a temp title
      update('title', 'Untitled Bug')
    }

    const data: any = {
      title: f.title || 'Untitled Bug',
      severity: f.severity,
      content: f.content,
      tags: tags(),
    }
    if (f.bsp_module_id) data.bsp_module_id = Number(f.bsp_module_id)
    if (f.kernel_version) data.kernel_version = f.kernel_version
    if (f.soc) data.soc = f.soc

    const res = await bugs.create(data)
    const id = (res as any).id
    setBugId(id)
    return id
  }

  const save = async (e: Event) => {
    e.preventDefault()
    setSaving(true)
    try {
      const existingId = bugId()
      if (existingId) {
        // Bug already created (via image upload), just update
        const f = form()
        const data: any = {
          title: f.title,
          severity: f.severity,
          content: f.content,
          tags: tags(),
        }
        if (f.bsp_module_id) data.bsp_module_id = Number(f.bsp_module_id)
        if (f.kernel_version) data.kernel_version = f.kernel_version
        if (f.soc) data.soc = f.soc
        await bugs.update(existingId, data)
        navigate(`/bugs/${existingId}`)
      } else {
        const f = form()
        const data: any = {
          title: f.title,
          severity: f.severity,
          content: f.content,
          tags: tags(),
        }
        if (f.bsp_module_id) data.bsp_module_id = Number(f.bsp_module_id)
        if (f.kernel_version) data.kernel_version = f.kernel_version
        if (f.soc) data.soc = f.soc
        const res = await bugs.create(data)
        navigate(`/bugs/${(res as any).id}`)
      }
    } catch (err) {
      alert('Save failed: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="w-full">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-white">New Bug Record</h2>
        <button
          onClick={() => navigate(-1 as any)}
          class="text-sm text-gray-500 hover:text-accent transition"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={save} class="space-y-5">
        {/* Title */}
        <div>
          <label class="block text-xs text-gray-500 mb-1.5 font-medium">Title *</label>
          <input
            type="text"
            value={form().title}
            onInput={(e) => update('title', e.currentTarget.value)}
            placeholder="e.g. RK3588 HDMI 4K60 display flickering"
            class="w-full bg-surface border border-border/30 rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition"
            required
          />
        </div>

        {/* Meta row */}
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1.5 font-medium">BSP Module</label>
            <select
              value={form().bsp_module_id}
              onChange={(e) => update('bsp_module_id', e.currentTarget.value)}
              class="w-full bg-surface border border-border/30 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-accent/40 transition"
            >
              <option value="">-- None --</option>
              <For each={modules()}>
                {(mod) => (
                  <>
                    <optgroup label={mod.name}>
                      <For each={mod.children || []}>
                        {(child) => (
                          <option value={child.id}>{child.name}</option>
                        )}
                      </For>
                    </optgroup>
                  </>
                )}
              </For>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1.5 font-medium">Severity</label>
            <select
              value={form().severity}
              onChange={(e) => update('severity', e.currentTarget.value)}
              class="w-full bg-surface border border-border/30 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-accent/40 transition"
            >
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
              <option value="cosmetic">Cosmetic</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1.5 font-medium">Kernel Version</label>
            <input
              type="text"
              value={form().kernel_version}
              onInput={(e) => update('kernel_version', e.currentTarget.value)}
              placeholder="e.g. 5.10.160"
              class="w-full bg-surface border border-border/30 rounded-lg px-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition"
            />
          </div>
        </div>

        {/* SoC + Tags */}
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1.5 font-medium">SoC</label>
            <input
              type="text"
              value={form().soc}
              onInput={(e) => update('soc', e.currentTarget.value)}
              placeholder="e.g. RK3588"
              class="w-full bg-surface border border-border/30 rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1.5 font-medium">Tags</label>
            <TagInput tags={tags()} onChange={setTags} placeholder="Press Enter to add tag" />
          </div>
        </div>

        {/* Unified Content Editor with image support */}
        <div>
          <label class="block text-xs text-gray-500 mb-1.5 font-medium">Content * (Markdown)</label>
          <ImageDropZone
            value={form().content}
            onInput={(val: string) => update('content', val)}
            articleType="bug"
            articleId={bugId()}
            onNeedId={ensureBugCreated}
            class="w-full bg-surface border border-border/30 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition font-mono text-sm overflow-hidden"
          />
          <div class="text-xs text-gray-600 mt-1">Paste, drag & drop, or click + Image to insert images</div>
        </div>

        {/* Submit */}
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving()}
            class="px-6 py-2.5 bg-accent/10 border border-accent/30 text-accent rounded-lg font-medium hover:bg-accent/20 transition-all disabled:opacity-50"
          >
            {saving() ? 'Saving...' : 'Save Bug Record'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1 as any)}
            class="px-6 py-2.5 bg-surface border border-border/30 rounded-lg text-gray-400 hover:text-gray-200 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
