import { createSignal, onMount, JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { stats } from '../api/client'
import Sidebar from './Sidebar'

export default function Layout(props: { children: JSX.Element }) {
  const [counts, setCounts] = createSignal({ bugs: 0, wikis: 0 })
  const [searchQ, setSearchQ] = createSignal('')
  const navigate = useNavigate()

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
          <div class="ml-4 flex gap-2">
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
