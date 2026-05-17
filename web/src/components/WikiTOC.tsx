import { createSignal, onMount, onCleanup, For, Show } from 'solid-js'
import { getHeadings, HeadingInfo } from './MarkdownRenderer'

export default function WikiTOC() {
  const [headings, setHeadings] = createSignal<HeadingInfo[]>([])
  const [activeId, setActiveId] = createSignal('')
  let navRef: HTMLDivElement | undefined
  let scrollContainer: HTMLElement | null = null
  let scrollHandler: (() => void) | null = null

  onMount(() => {
    // Find the scrollable container — Layout uses <main class="flex-1 overflow-auto">
    scrollContainer = document.querySelector('main.overflow-auto') || document.querySelector('main')

    const hs = getHeadings()
    if (hs.length === 0) return

    setHeadings(hs)
    setActiveId(hs[0].id)

    let rafId = 0
    const onScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const items = headings()
        if (items.length === 0) return

        const containerRect = scrollContainer?.getBoundingClientRect()
        const offset = (containerRect?.top || 0) + 40

        let current = items[0].id

        for (const h of items) {
          const el = document.getElementById(h.id)
          if (!el) continue
          const top = el.getBoundingClientRect().top
          if (top <= offset) {
            current = h.id
          } else {
            break
          }
        }
        setActiveId(current)

        // Auto-scroll TOC nav to keep active item visible
        if (navRef) {
          const btn = navRef.querySelector(`[data-heading="${current}"]`) as HTMLElement
          if (btn) {
            const navScrollParent = navRef.closest('.overflow-y-auto') as HTMLElement
            if (navScrollParent) {
              const btnTop = btn.offsetTop - navScrollParent.offsetTop
              const visible = navScrollParent.scrollTop
              const height = navScrollParent.clientHeight
              if (btnTop < visible || btnTop > visible + height - 30) {
                navScrollParent.scrollTop = btnTop - height / 3
              }
            }
          }
        }
      })
    }

    scrollHandler = onScroll
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', scrollHandler, { passive: true })
    }
    onScroll()
  })

  onCleanup(() => {
    if (scrollHandler) {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', scrollHandler)
      }
      scrollHandler = null
    }
  })

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el && scrollContainer) {
      const mainStyle = window.getComputedStyle(scrollContainer)
      const mainPaddingTop = parseInt(mainStyle.paddingTop) || 0
      const targetScroll = el.offsetTop - scrollContainer.offsetTop - mainPaddingTop - 8
      // Instant jump first to cancel any ongoing smooth scroll, then animate
      scrollContainer.scrollTo({ top: targetScroll, behavior: 'instant' })
      setActiveId(id)
    }
  }

  const indent = (level: number) => {
    const map: Record<number, string> = { 2: 'pl-2', 3: 'pl-5', 4: 'pl-8', 5: 'pl-11', 6: 'pl-14' }
    return map[level] || 'pl-2'
  }

  return (
    <Show when={headings().length > 0}>
      <nav class="w-52 shrink-0">
        <div class="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1" style="scrollbar-width: thin;">
          <div class="text-sm uppercase tracking-wider text-secondary/70 font-semibold mb-3">On This Page</div>
          <div class="space-y-0.5" ref={navRef}>
            <For each={headings()}>
              {(h) => (
                <button
                  data-heading={h.id}
                  class={`block w-full text-left text-[15px] leading-snug py-1.5 px-2 rounded transition truncate ${indent(h.level)} ${
                    activeId() === h.id
                      ? 'text-accent bg-accent/10 font-medium'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-surface/50'
                  }`}
                  onClick={() => scrollTo(h.id)}
                  title={h.text}
                >
                  {h.text}
                </button>
              )}
            </For>
          </div>
        </div>
      </nav>
    </Show>
  )
}
