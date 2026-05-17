import { onMount } from 'solid-js'
import { marked } from 'marked'
import hljs from 'highlight.js'

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

    // Highlight code blocks
    ref.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement)
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
