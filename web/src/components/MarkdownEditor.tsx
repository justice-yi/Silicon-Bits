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
        const editArea = containerRef?.querySelector('.vditor-ir')
        if (editArea) {
          editArea.addEventListener('paste', handleLocalPaste, true)
        }
      },
    })
  })

  onCleanup(() => {
    const editArea = containerRef?.querySelector('.vditor-ir')
    if (editArea) {
      editArea.removeEventListener('paste', handleLocalPaste, true)
    }
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
