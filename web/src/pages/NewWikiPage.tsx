import { createSignal, createEffect } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { wikis } from '../api/client'
import TagInput from '../components/TagInput'

export default function NewWikiPage() {
  const navigate = useNavigate()
  const [saving, setSaving] = createSignal(false)
  const [tags, setTags] = createSignal<string[]>([])
  let contentRef: HTMLTextAreaElement | undefined

  // Auto-resize when content changes
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
      const res = await wikis.create({
        title: f.title,
        category: f.category,
        content: f.content,
        source: f.source,
        tags: tags(),
      })
      navigate(`/wikis/${(res as any).id}`)
    } catch (err) {
      alert('Save failed: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
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

        {/* Category + Tags */}
        <div class="grid grid-cols-2 gap-4">
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
