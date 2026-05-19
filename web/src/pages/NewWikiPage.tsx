import { createSignal, createEffect, onMount, For } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { wikis, bspTree } from '../api/client'
import TagInput from '../components/TagInput'

interface BSPModule {
  id: number
  name: string
  slug: string
  icon: string
  bug_count: number
  wiki_count: number
  children?: BSPModule[]
}

export default function NewWikiPage() {
  const navigate = useNavigate()
  const [saving, setSaving] = createSignal(false)
  const [tags, setTags] = createSignal<string[]>([])
  const [bspModules, setBspModules] = createSignal<BSPModule[]>([])
  let contentRef: HTMLTextAreaElement | undefined

  onMount(async () => {
    try {
      const data = await bspTree()
      setBspModules(data as BSPModule[])
    } catch {}
  })

  createEffect(() => {
    const val = form().content
    if (contentRef) {
      queueMicrotask(() => {
        if (contentRef) {
          contentRef.style.height = 'auto'
          contentRef.style.height = contentRef.scrollHeight + 'px'
        }
      })
    }
  })

  const [form, setForm] = createSignal({
    title: '',
    category: 'driver-dev',
    bsp_module_id: '' as string,
    content: '',
    source: 'original',
  })

  const update = (key: string, value: string) => {
    setForm({ ...form(), [key]: value })
  }

  const save = async (e: Event) => {
    e.preventDefault()
    setSaving(true)
    try {
      const f = form()
      const payload: any = {
        title: f.title,
        category: f.category,
        content: f.content,
        source: f.source,
        tags: tags(),
      }
      if (f.bsp_module_id) {
        payload.bsp_module_id = Number(f.bsp_module_id)
      }
      const res = await wikis.create(payload)
      navigate(`/wikis/${(res as any).id}`)
    } catch (err) {
      alert('Save failed: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
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
    <div class="w-full">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-white">New Wiki Article</h2>
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
            placeholder="e.g. HDMI Timing Deep Dive"
            class="w-full bg-surface border border-border/30 rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition"
            required
          />
        </div>

        {/* Category + Module + Tags */}
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1.5 font-medium">Category</label>
            <select
              value={form().category}
              onChange={(e) => update('category', e.currentTarget.value)}
              class="w-full bg-surface border border-border/30 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-accent/40 transition"
            >
              <option value="driver-dev">Driver Dev</option>
              <option value="kernel">Kernel</option>
              <option value="hardware">Hardware</option>
              <option value="tool">Tool</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1.5 font-medium">BSP Module</label>
            <select
              value={form().bsp_module_id}
              onChange={(e) => update('bsp_module_id', e.currentTarget.value)}
              class="w-full bg-surface border border-border/30 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-accent/40 transition"
            >
              <option value="">-- None --</option>
              <For each={flatModules()}>
                {(mod) => (
                  <option value={String(mod.id)}>{mod.indent ? `  └ ${mod.name}` : mod.name}</option>
                )}
              </For>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1.5 font-medium">Tags</label>
            <TagInput tags={tags()} onChange={setTags} placeholder="Press Enter to add tag" />
          </div>
        </div>

        {/* Content */}
        <div>
          <label class="block text-xs text-gray-500 mb-1.5 font-medium">Content * (Markdown)</label>
          <textarea
            ref={contentRef}
            value={form().content}
            onInput={(e) => { update('content', e.currentTarget.value); e.currentTarget.style.height='auto'; e.currentTarget.style.height=e.currentTarget.scrollHeight+'px' }}
            placeholder="Write your article in Markdown..."
            rows={1}
            class="w-full bg-surface border border-border/30 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/40 transition font-mono text-sm overflow-hidden min-h-[200px]"
            required
          />
        </div>

        {/* Submit */}
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving()}
            class="px-6 py-2.5 bg-secondary/10 border border-secondary/30 text-secondary rounded-lg font-medium hover:bg-secondary/20 transition-all disabled:opacity-50"
          >
            {saving() ? 'Saving...' : 'Save Article'}
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
