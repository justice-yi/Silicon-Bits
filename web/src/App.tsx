import { JSX, Show, createSignal } from 'solid-js'
import { setCredentials, getCredentials } from './api/client'
import Layout from './components/Layout'
import { ThemeProvider } from './components/ThemeProvider'

export default function App(props: { children: JSX.Element }) {
  const [authed, setAuthed] = createSignal(!!getCredentials())
  const [user, setUser] = createSignal('')
  const [pass, setPass] = createSignal('')
  const [error, setError] = createSignal('')

  const login = (e: Event) => {
    e.preventDefault()
    setCredentials(user(), pass())
    fetch('/api/stats', {
      headers: { Authorization: 'Basic ' + btoa(user() + ':' + pass()) }
    }).then(r => {
      if (r.ok) {
        setAuthed(true)
        setError('')
      } else {
        setError('Invalid credentials')
        setCredentials('', '')
      }
    }).catch(() => {
      setError('Connection failed')
      setCredentials('', '')
    })
  }

  return (
    <ThemeProvider>
    <Show
      when={authed()}
      fallback={
        <div class="min-h-screen flex items-center justify-center grid-bg">
          <div class="w-full max-w-sm">
            <div class="text-center mb-8">
              <h1 class="text-3xl font-bold glow-green text-accent font-mono">Silicon Bits</h1>
              <p class="text-gray-500 mt-2 text-sm">Embedded Linux Debug Knowledge Base</p>
            </div>
            <form onSubmit={login} class="bg-card border border-border/50 rounded-xl p-6 space-y-4">
              <Show when={error()}>
                <div class="text-danger text-sm text-center">{error()}</div>
              </Show>
              <input
                type="text"
                placeholder="Username"
                value={user()}
                onInput={(e) => setUser(e.currentTarget.value)}
                class="w-full bg-surface border border-border/50 rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent/50 transition"
              />
              <input
                type="password"
                placeholder="Password"
                value={pass()}
                onInput={(e) => setPass(e.currentTarget.value)}
                class="w-full bg-surface border border-border/50 rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent/50 transition"
              />
              <button
                type="submit"
                class="w-full bg-accent/10 border border-accent/30 text-accent rounded-lg py-2.5 font-medium hover:bg-accent/20 transition-all"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      }
    >
      <Layout>
        {props.children}
      </Layout>
    </Show>
    </ThemeProvider>
  )
}
