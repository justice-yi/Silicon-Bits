import { createSignal, onMount, JSX, Show, For } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { stats } from '../api/client'
import Sidebar from './Sidebar'
import { useTheme, THEMES } from './ThemeProvider'

export default function Layout(props: { children: JSX.Element }) {
  const [counts, setCounts] = createSignal({ bugs: 0, wikis: 0 })
  const [searchQ, setSearchQ] = createSignal('')
  const [themeOpen, setThemeOpen] = createSignal(false)
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  onMount(() => {
    stats().then((s: any) => setCounts(s)).catch(() => {})
  })

  const doSearch = (e: Event) => {
    e.preventDefault()
    if (searchQ().trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQ().trim())}`)
    }
  }

  return (
    <div class="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar onNavigate={() => {
        stats().then((s: any) => setCounts(s)).catch(() => {})
      }} />

      {/* Main content */}
      <div class="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header class="h-14 border-b border-border/50 flex items-center px-6 bg-card/50 backdrop-blur-sm shrink-0">
          <h1 class="text-lg font-mono font-bold text-accent glow-green">Silicon Bits</h1>

          {/* Search */}
          <form onSubmit={doSearch} class="ml-8 flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search bugs, wikis... (Ctrl+K)"
              value={searchQ()}
              onInput={(e) => setSearchQ(e.currentTarget.value)}
              class="w-full bg-surface/50 border border-border/30 rounded-lg px-4 py-1.5 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-accent/40 transition"
            />
          </form>

          {/* Action buttons */}
          <div class="ml-4 flex gap-2 items-center">
            {/* Theme picker */}
            <div class="relative">
              <button
                onClick={() => setThemeOpen(!themeOpen())}
                onBlur={() => setTimeout(() => setThemeOpen(false), 150)}
                class="w-8 h-8 rounded-lg border border-border/30 bg-surface/50 flex items-center justify-center hover:border-accent/40 transition"
                title="Change theme"
              >
                <span
                  class="w-3.5 h-3.5 rounded-full"
                  style={{ "background-color": THEMES.find(t => t.id === theme())?.accent || '#00ff88' }}
                />
              </button>
              <Show when={themeOpen()}>
                <div class="absolute right-0 top-full mt-1 w-48 bg-card border border-border/50 rounded-xl shadow-2xl py-1.5 z-50 max-h-[70vh] overflow-y-auto">
                  <For each={THEMES}>
                    {(t) => (
                      <button
                        class={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface transition text-left ${theme() === t.id ? 'text-accent' : 'text-gray-300'}`}
                        onClick={() => { setTheme(t.id); setThemeOpen(false) }}
                      >
                        <span
                          class="w-3 h-3 rounded-full shrink-0"
                          style={{ "background-color": t.accent }}
                        />
                        <span class="font-mono text-xs">{t.name}</span>
                        <Show when={theme() === t.id}>
                          <span class="ml-auto text-accent text-xs">✓</span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
            <button
              onClick={() => navigate('/bugs/new')}
              class="px-3 py-1.5 text-sm bg-accent/10 border border-accent/30 text-accent rounded-lg hover:bg-accent/20 transition-all"
            >
              + Bug
            </button>
            <button
              onClick={() => navigate('/wikis/new')}
              class="px-3 py-1.5 text-sm bg-secondary/10 border border-secondary/30 text-secondary rounded-lg hover:bg-secondary/20 transition-all"
            >
              + Wiki
            </button>
          </div>
        </header>

        {/* Content */}
        <main class="flex-1 overflow-auto p-8 grid-bg w-full">
          {props.children}
        </main>

        {/* Footer */}
        <footer class="h-8 border-t border-border/30 flex items-center justify-center text-xs text-gray-500 bg-card/30 shrink-0 font-mono">
          {counts().bugs} bugs &middot; {counts().wikis} wikis &middot; SQLite
        </footer>
      </div>
    </div>
  )
}
