import { createSignal, createEffect, Show } from 'solid-js'
import { getCredentials } from '../api/client'

interface Props {
  value: string
  onInput: (value: string) => void
  articleType: 'bug' | 'wiki'
  articleId: number | null
  /** Called when an upload needs an article ID but none exists yet.
   *  Should create the article and return its ID. */
  onNeedId?: () => Promise<number>
  placeholder?: string
  class?: string
  rows?: number
}

export default function ImageDropZone(props: Props) {
  const [uploading, setUploading] = createSignal(false)
  const [dragOver, setDragOver] = createSignal(false)
  let textareaRef: HTMLTextAreaElement | undefined
  let fileInputRef: HTMLInputElement | undefined

  // Auto-resize whenever content changes (including initial load)
  createEffect(() => {
    const val = props.value
    if (textareaRef) {
      queueMicrotask(() => {
        if (textareaRef) autoResize(textareaRef)
      })
    }
  })

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const insertMarkdown = (markdown: string) => {
    const ta = textareaRef
    if (ta) {
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const before = props.value.substring(0, start)
      const after = props.value.substring(end)
      const newValue = before + markdown + after
      props.onInput(newValue)
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + markdown.length
        ta.focus()
      }, 0)
    } else {
      props.onInput(props.value + '\n' + markdown)
    }
  }

  // Ensure we have an article ID; auto-create if onNeedId is provided
  const ensureArticleId = async (): Promise<number | null> => {
    if (props.articleId) return props.articleId
    if (props.onNeedId) {
      try {
        return await props.onNeedId()
      } catch (err) {
        alert('Cannot upload: ' + (err as Error).message)
        return null
      }
    }
    alert('Please save the article first before uploading images.')
    return null
  }

  const uploadFile = async (file: File) => {
    const id = await ensureArticleId()
    if (!id) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', props.articleType)
      formData.append('id', String(id))

      const auth = getCredentials() || ''
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: auth },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
      const data = await res.json()
      insertMarkdown(`![${data.filename || file.name}](${data.url})`)
    } catch (err) {
      alert('Image upload failed: ' + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const uploadLocalFile = async (filePath: string) => {
    const id = await ensureArticleId()
    if (!id) return

    setUploading(true)
    try {
      const auth = getCredentials() || ''
      const res = await fetch('/api/upload-local', {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: filePath,
          type: props.articleType,
          id: String(id),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
      const data = await res.json()
      insertMarkdown(`![${data.filename}](${data.url})`)
    } catch (err) {
      alert('Local file upload failed: ' + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    // First: check for image/* data
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) uploadFile(file)
        return
      }
    }

    // Second: check for text containing file:// path (Nautilus/VMware clipboard)
    for (const item of items) {
      if (item.type === 'text/plain' || item.type.startsWith('text/')) {
        const text = e.clipboardData?.getData('text/plain') || ''
        const imgExt = 'png|jpg|jpeg|gif|webp|svg|bmp|ico|avif|tiff|tif'
        const fileUrlMatch = text.match(new RegExp(`file:///(\\S+\\.(${imgExt}))`, 'i'))
        if (fileUrlMatch) {
          e.preventDefault()
          const filePath = '/' + fileUrlMatch[1]
          uploadLocalFile(filePath)
          return
        }
        const barePathMatch = text.match(new RegExp(`(^|\\n)(/\\S+\\.(${imgExt}))\\s*$`, 'im'))
        if (barePathMatch) {
          e.preventDefault()
          uploadLocalFile(barePathMatch[2])
          return
        }
        break
      }
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer?.files
    if (!files) return
    const imgExts = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif|tiff|tif)$/i
    for (const file of files) {
      if (file.type.startsWith('image/') || imgExts.test(file.name)) {
        uploadFile(file)
      }
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleFileSelect = () => {
    fileInputRef?.click()
  }

  const onFilesSelected = (e: Event) => {
    const input = e.target as HTMLInputElement
    if (!input.files) return
    const imgExts = /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif|tiff|tif)$/i
    for (const file of input.files) {
      if (file.type.startsWith('image/') || imgExts.test(file.name)) {
        uploadFile(file)
      }
    }
    input.value = ''
  }

  return (
    <div class="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.bmp,.ico,.avif,.tiff,.tif"
        multiple
        style="display:none"
        onChange={onFilesSelected}
      />
      <textarea
        ref={textareaRef}
        value={props.value}
        onInput={(e) => { props.onInput(e.currentTarget.value); autoResize(e.currentTarget) }}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        placeholder={props.placeholder}
        rows={1}
        class={`${props.class || ''} min-h-[200px] ${dragOver() ? 'border-accent/60 ring-1 ring-accent/30' : ''}`}
      />
      <div class="absolute top-2 right-2 flex gap-2 items-center">
        <Show when={uploading()}>
          <span class="text-xs text-accent bg-surface/90 px-2.5 py-1 rounded border border-accent/20">
            Uploading...
          </span>
        </Show>
        <button
          type="button"
          onClick={handleFileSelect}
          class="text-xs text-gray-400 hover:text-accent bg-surface/90 px-2.5 py-1 rounded border border-border/30 transition"
          title="Insert image from file"
        >
          + Image
        </button>
      </div>
      <Show when={dragOver()}>
        <div class="absolute inset-0 flex items-center justify-center bg-surface/50 rounded-lg pointer-events-none">
          <span class="text-accent text-sm font-medium">Drop image here</span>
        </div>
      </Show>
    </div>
  )
}
