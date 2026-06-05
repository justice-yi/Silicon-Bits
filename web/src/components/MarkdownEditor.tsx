import { onMount, onCleanup, createEffect } from 'solid-js'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { getCredentials } from '../api/client'

interface Props {
  value: string
  onInput: (value: string) => void
  articleType: 'bug' | 'wiki'
  articleId: number | null
  onNeedId?: () => Promise<number>
  placeholder?: string
  class?: string
  fillHeight?: boolean
}

export default function MarkdownEditor(props: Props) {
  let containerRef: HTMLDivElement | undefined
  let vditorRef: Vditor | undefined
  let isInternalUpdate = false
  let isSettingValue = false
  let isReady = false
  let pendingValue: string | null = null

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

  const doUploadFile = async (file: File): Promise<string | null> => {
    const id = await ensureArticleId()
    if (!id) return null

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
    return data.url
  }

  const doUploadLocalFile = async (filePath: string): Promise<string | null> => {
    const id = await ensureArticleId()
    if (!id) return null

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
    return data.url
  }

  // Exit ordered list by modifying the Markdown source directly.
  const exitListItem = (liElement: HTMLElement) => {
    if (!vditorRef) return

    const md = vditorRef.getValue()
    const lines = md.split('\n')

    // Get marker number from data-marker attribute (e.g., "4.")
    const markerAttr = liElement.getAttribute('data-marker') || ''
    const markerNum = markerAttr.replace(/\.\s*$/, '')
    const prefix = markerNum + '. '

    // Find the target line in the Markdown
    let targetIdx = lines.findIndex(l => l.startsWith(prefix))
    if (targetIdx === -1) return

    // Extract content after "N. "
    const content = lines[targetIdx].substring(prefix.length)

    // Replace list item with: blank line (terminates list) + content as regular paragraph
    lines[targetIdx] = ''
    lines.splice(targetIdx + 1, 0, content)

    const newMd = lines.join('\n')

    isSettingValue = true
    vditorRef.setValue(newMd)
    isSettingValue = false

    isInternalUpdate = true
    props.onInput(newMd)
    isInternalUpdate = false
  }

  // Backspace at start of ordered list item → remove marker, convert to paragraph
  // (Enter on empty item is handled natively by Vditor)
  const handleListExit = (e: KeyboardEvent) => {
    if (e.key !== 'Backspace' || e.ctrlKey || e.metaKey) return

    const target = e.target as HTMLElement
    if (!target) return

    const irReset = target.closest('pre.vditor-reset') as HTMLElement | null
    if (!irReset || !containerRef?.contains(irReset)) return

    const sel = window.getSelection()
    if (!sel || !sel.isCollapsed) return

    const node = sel.anchorNode
    if (!node) return

    const el = node instanceof HTMLElement ? node : node.parentElement
    if (!el) return

    // In Vditor IR mode, ordered lists use <ol><li data-marker="N.">...</li></ol>
    const li = el.closest('li[data-marker]') as HTMLElement | null
    if (!li) return

    const marker = li.getAttribute('data-marker') || ''
    // Only handle ordered list markers (e.g., "1.", "2.", "4.")
    if (!/^\d+\.\s*$/.test(marker)) return

    // Backspace: cursor must be at the very start of the LI content
    const range = document.createRange()
    range.setStart(li, 0)
    range.setEnd(sel.anchorNode, sel.anchorOffset)
    const textBefore = range.toString().replace(/[\s\u200B\uFEFF]/g, '')
    if (textBefore !== '') return

    e.preventDefault()
    e.stopImmediatePropagation()
    exitListItem(li)
  }

  // Custom paste handler for file:// paths (Nautilus / VMware clipboard)
  const handleLocalPaste = async (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text/plain') || ''
    if (!text.includes('file://') && !text.match(/^\/\S+\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif|tiff|tif)$/im)) return

    const imgExt = 'png|jpg|jpeg|gif|webp|svg|bmp|ico|avif|tiff|tif'

    const fileUrlMatch = text.match(new RegExp(`file:///(\\S+\\.(${imgExt}))`, 'i'))
    if (fileUrlMatch) {
      e.preventDefault()
      e.stopPropagation()
      const filePath = '/' + fileUrlMatch[1]
      try {
        const url = await doUploadLocalFile(filePath)
        if (url && vditorRef) vditorRef.insertValue(`![image](${url})\n`)
      } catch (err) {
        alert('Local file upload failed: ' + (err as Error).message)
      }
      return
    }

    const barePathMatch = text.match(new RegExp(`(^|\\n)(/\\S+\\.(${imgExt}))\\s*$`, 'im'))
    if (barePathMatch) {
      e.preventDefault()
      e.stopPropagation()
      try {
        const url = await doUploadLocalFile(barePathMatch[2])
        if (url && vditorRef) vditorRef.insertValue(`![image](${url})\n`)
      } catch (err) {
        alert('Local file upload failed: ' + (err as Error).message)
      }
    }
  }

  onMount(() => {
    if (!containerRef) return

    vditorRef = new Vditor(containerRef, {
      mode: 'ir',
      theme: 'dark',
      icon: 'material',
      placeholder: props.placeholder || '',
      value: props.value,
      cdn: '/vditor',
      input: () => {
        if (isSettingValue) return
        const md = vditorRef?.getValue()
        if (md !== undefined) {
          isInternalUpdate = true
          props.onInput(md)
          isInternalUpdate = false
        }
      },
      upload: {
        handler: async (files: File[]): Promise<null> => {
          for (const file of files) {
            try {
              const url = await doUploadFile(file)
              if (url && vditorRef) {
                vditorRef.insertValue(`![${file.name}](${url})\n`)
              }
            } catch (err) {
              alert('Upload failed: ' + (err as Error).message)
            }
          }
          return null
        },
        accept: 'image/*',
        multiple: true,
      },
      toolbar: [
        'headings', 'bold', 'italic', 'strike', '|',
        'list', 'ordered-list', 'check', '|',
        'quote', 'code', 'inline-code', '|',
        'upload', 'table', '|',
        'undo', 'redo',
      ],
      toolbarConfig: {
        hide: false,
        pin: true,
      },
      cache: {
        enable: false,
      },
      height: props.fillHeight ? '100%' : 'auto',
      minHeight: 300,
      preview: {
        theme: {
          current: 'dark',
        },
      },
      after: () => {
        isReady = true
        // Apply pending value if it changed during init
        if (pendingValue !== null) {
          isSettingValue = true
          vditorRef?.setValue(pendingValue)
          isSettingValue = false
          pendingValue = null
        }

        // Attach custom paste handler for local file paths
        const editArea = containerRef?.querySelector('pre.vditor-reset')
        if (editArea) {
          editArea.addEventListener('paste', handleLocalPaste, true)
        }
        // Register list-exit handler at document level (capture phase) to fire before Vditor
        document.addEventListener('keydown', handleListExit, true)
      },
    })
  })

  onCleanup(() => {
    const editArea = containerRef?.querySelector('pre.vditor-reset')
    if (editArea) {
      editArea.removeEventListener('paste', handleLocalPaste, true)
    }
    document.removeEventListener('keydown', handleListExit, true)
    vditorRef?.destroy()
    vditorRef = undefined
    isReady = false
  })

  // Sync external value changes to Vditor
  createEffect(() => {
    const val = props.value
    if (!isReady) {
      pendingValue = val
      return
    }
    if (vditorRef && !isInternalUpdate) {
      isSettingValue = true
      vditorRef.setValue(val)
      isSettingValue = false
    }
  })

  return (
    <div
      ref={containerRef}
      class={`markdown-editor ${props.class || ''}`}
      style={props.fillHeight ? { height: '100%' } : undefined}
    />
  )
}
