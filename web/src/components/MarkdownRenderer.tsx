import { onMount } from 'solid-js'
import { marked } from 'marked'
import hljs from 'highlight.js'
import { request } from '../api/client'

declare const WaveDrom: any

// Cached draw.io embed URL
let drawioBase = ''
async function getDrawioURL(): Promise<string> {
  if (drawioBase !== '') return drawioBase
  try {
    const res = await request('/drawio/config') as any
    drawioBase = res.url || ''
  } catch { drawioBase = '' }
  return drawioBase
}

interface Props {
  content: string
  class?: string
  /** Base path for resolving relative image URLs, e.g. "/wiki/My Article" */
  imageBasePath?: string
}

// Shared heading list — populated after render
export interface HeadingInfo {
  id: string
  text: string
  level: number
}

let currentHeadings: HeadingInfo[] = []

export function getHeadings(): HeadingInfo[] {
  return currentHeadings
}

marked.setOptions({
  breaks: true,
  gfm: true,
})

function initDrawioViewer(container: HTMLElement, src: string) {
  // Create wrapper
  const wrapper = document.createElement('div')
  wrapper.style.position = 'relative'
  wrapper.style.margin = '12px 0'
  wrapper.style.border = '1px solid rgb(var(--color-border) / 0.3)'
  wrapper.style.borderRadius = '8px'
  wrapper.style.overflow = 'hidden'
  wrapper.style.background = 'rgb(var(--color-card))'

  // Toolbar
  const toolbar = document.createElement('div')
  toolbar.style.display = 'flex'
  toolbar.style.justifyContent = 'flex-end'
  toolbar.style.padding = '6px 10px'
  toolbar.style.background = 'rgb(var(--color-surface))'
  toolbar.style.borderBottom = '1px solid rgb(var(--color-border) / 0.2)'

  const editBtn = document.createElement('button')
  editBtn.textContent = '✏️ Edit'
  editBtn.style.cssText = 'font-size:12px;padding:3px 10px;border-radius:4px;cursor:pointer;border:1px solid rgb(var(--color-border) / 0.4);background:transparent;color:rgb(var(--color-accent));transition:all 0.15s'
  editBtn.onmouseenter = () => editBtn.style.background = 'rgb(var(--color-accent) / 0.1)'
  editBtn.onmouseleave = () => editBtn.style.background = 'transparent'
  toolbar.appendChild(editBtn)

  // Iframe container
  const iframeContainer = document.createElement('div')
  iframeContainer.style.minHeight = '300px'
  iframeContainer.style.position = 'relative'
  iframeContainer.style.display = 'flex'
  iframeContainer.style.alignItems = 'center'
  iframeContainer.style.justifyContent = 'center'
  iframeContainer.innerHTML = '<span style="color:rgb(var(--color-accent) / 0.5);font-size:13px">Loading diagram...</span>'

  // Transparent overlay to capture double-click (iframe eats mouse events)
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;cursor:pointer;z-index:10'
  overlay.title = 'Double-click to edit'
  iframeContainer.appendChild(overlay)

  wrapper.appendChild(toolbar)
  wrapper.appendChild(iframeContainer)
  container.replaceWith(wrapper)

  let currentIframe: HTMLIFrameElement | null = null
  let currentXml: string = ''
  let drawioUrl = ''
  let isEditing = false

  // Handle fullscreen change — expand/shrink height
  function onFullscreenChange() {
    if (document.fullscreenElement === wrapper) {
      wrapper.style.height = '100vh'
      wrapper.style.margin = '0'
      wrapper.style.borderRadius = '0'
      wrapper.style.display = 'flex'
      wrapper.style.flexDirection = 'column'
      iframeContainer.style.flex = '1'
      iframeContainer.style.minHeight = '0'
      if (currentIframe) {
        currentIframe.style.height = '100%'
        currentIframe.style.minHeight = '100%'
      }
    } else {
      wrapper.style.height = ''
      wrapper.style.margin = '12px 0'
      wrapper.style.borderRadius = '8px'
      wrapper.style.display = ''
      wrapper.style.flexDirection = ''
      iframeContainer.style.flex = ''
      iframeContainer.style.minHeight = '300px'
      if (currentIframe) {
        currentIframe.style.height = ''
        currentIframe.style.minHeight = '500px'
      }
    }
  }
  document.addEventListener('fullscreenchange', onFullscreenChange)

  // Enter edit mode with fullscreen
  function enterEdit() {
    if (isEditing || !drawioUrl) return
    isEditing = true
    editBtn.textContent = 'Editing...'
    overlay.style.display = 'none'
    createIframe(true)
    // Enter fullscreen
    if (!document.fullscreenElement) wrapper.requestFullscreen().catch(() => {})
  }

  // Exit edit mode
  function exitEdit() {
    isEditing = false
    editBtn.textContent = '✏️ Edit'
    overlay.style.display = ''
    createIframe(false)
    // Exit fullscreen
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }

  // Double-click on overlay → fullscreen edit
  overlay.ondblclick = () => enterEdit()
  editBtn.onclick = (e) => { e.stopPropagation(); if (!isEditing) enterEdit() }

  function createIframe(editable: boolean) {
    if (currentIframe) currentIframe.remove()
    iframeContainer.innerHTML = ''
    if (!editable) iframeContainer.appendChild(overlay)

    const iframe = document.createElement('iframe')
    iframe.style.width = '100%'
    iframe.style.minHeight = '500px'
    iframe.style.border = 'none'
    iframe.style.display = 'block'

    // If already in fullscreen, match height immediately
    if (document.fullscreenElement === wrapper) {
      iframe.style.height = '100%'
      iframe.style.minHeight = '100%'
    }

    const params = editable
      ? '?embed=1&proto=json&spin=1&lang=zh'
      : '?embed=1&proto=json&spin=1&noSaveBtn=1&lightbox=1&lang=zh'
    iframe.src = drawioUrl + params
    iframeContainer.appendChild(iframe)
    currentIframe = iframe

    const handler = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return
      let msg: any
      try { msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data } catch { return }

      switch (msg.event) {
        case 'init':
          iframe.contentWindow?.postMessage(JSON.stringify({
            action: 'load',
            xml: currentXml,
            autosave: 0,
          }), '*')
          break
        case 'save':
          currentXml = msg.xml
          request('/drawio/save', {
            method: 'PUT',
            body: JSON.stringify({ url: src, xml: msg.xml }),
          }).then(() => {
            iframe.contentWindow?.postMessage(JSON.stringify({
              action: 'status', message: 'Saved ✓',
            }), '*')
          }).catch(() => {
            iframe.contentWindow?.postMessage(JSON.stringify({
              action: 'status', message: 'Save failed',
            }), '*')
          })
          break
        case 'exit':
          window.removeEventListener('message', handler)
          exitEdit()
          break
      }
    }
    window.addEventListener('message', handler)
  }

  // Fetch draw.io embed URL and XML, then render
  getDrawioURL().then(baseUrl => {
    if (!baseUrl) {
      iframeContainer.innerHTML = '<span style="color:rgb(var(--color-warning));font-size:13px">Draw.io not configured (set DRAWIO_URL env var)</span>'
      return
    }
    try {
      const url = new URL(baseUrl)
      url.hostname = location.hostname
      if (url.port === '8080' || url.port === '') url.port = '9091'
      drawioUrl = url.toString().replace(/\/$/, '')
    } catch {
      drawioUrl = baseUrl
    }

    fetch(src)
      .then(r => r.text())
      .then(xml => {
        currentXml = xml
        createIframe(false)
      })
      .catch(() => {
        iframeContainer.innerHTML = '<span style="color:rgb(var(--color-danger));font-size:13px">Failed to load diagram</span>'
      })
  })
}

export default function MarkdownRenderer(props: Props) {
  let ref: HTMLDivElement | undefined

  onMount(() => {
    if (!ref) return

    // Assign IDs to all headings and build heading list
    const els = ref.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const hs: HeadingInfo[] = []
    let counter = 0

    els.forEach((el) => {
      const h = el as HTMLHeadingElement
      counter++
      const id = 'heading-' + counter
      h.id = id
      if (parseInt(h.tagName[1]) >= 2) {
        hs.push({ id, text: (h.textContent || '').trim(), level: parseInt(h.tagName[1]) })
      }
    })

    currentHeadings = hs

    // Rewrite relative image paths to absolute URLs
    const base = props.imageBasePath || '/wiki'
    ref.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src')
      if (src && !src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
        img.setAttribute('src', base + '/' + src)
      }
    })

    // Embed draw.io diagrams
    ref.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || ''
      if (src.endsWith('.drawio')) {
        initDrawioViewer(img, src)
      }
    })

    // Highlight code blocks
    ref.querySelectorAll('pre code').forEach((block) => {
      const el = block as HTMLElement
      // Skip wavedrom blocks — render as SVG instead
      if (el.classList.contains('language-wavedrom')) {
        if (typeof WaveDrom !== 'undefined') {
          try {
            const json = JSON.parse(el.textContent || '')
            const container = document.createElement('div')
            container.style.overflow = 'auto'
            container.style.margin = '12px 0'
            el.parentElement?.replaceWith(container)
            WaveDrom.renderWaveElement(0, json, container, WaveDrom.waveSkin)
          } catch (e) {
            console.warn('WaveDrom render error:', e)
          }
        }
        return
      }
      hljs.highlightElement(el)
    })
  })

  const html = () => {
    try {
      return marked.parse(props.content || '') as string
    } catch {
      return props.content
    }
  }

  return (
    <div
      ref={ref}
      class={`markdown-body ${props.class || ''}`}
      innerHTML={html()}
    />
  )
}
