import { createContext, useContext, createSignal, onMount, JSX, ParentComponent } from 'solid-js'

export const THEMES = [
  { id: 'theme-matrix', name: 'Matrix', accent: '#00ff88' },
  { id: 'theme-cyberpunk', name: 'Cyberpunk', accent: '#ff2d95' },
  { id: 'theme-dracula', name: 'Dracula', accent: '#bd93f9' },
  { id: 'theme-tokyo-night', name: 'Tokyo Night', accent: '#7aa2f7' },
  { id: 'theme-nord', name: 'Nord', accent: '#88c0d0' },
  { id: 'theme-catppuccin', name: 'Catppuccin', accent: '#cba6f7' },
  { id: 'theme-gruvbox', name: 'Gruvbox', accent: '#fabd2f' },
  { id: 'theme-monokai', name: 'Monokai', accent: '#e6db74' },
  { id: 'theme-solarized-dark', name: 'Solarized Dark', accent: '#268bd2' },
  { id: 'theme-ocean', name: 'Ocean', accent: '#2dd4bf' },
  { id: 'theme-sunset', name: 'Sunset', accent: '#fb923c' },
  { id: 'theme-rose-pine', name: 'Rosé Pine', accent: '#c4a7e7' },
] as const

export type ThemeId = typeof THEMES[number]['id']

const STORAGE_KEY = 'silicon-bits-theme'
const DEFAULT_THEME: ThemeId = 'theme-matrix'

interface ThemeContextValue {
  theme: () => ThemeId
  setTheme: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue>()

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

function applyTheme(id: ThemeId) {
  const html = document.documentElement
  // Remove all theme classes
  THEMES.forEach(t => html.classList.remove(t.id))
  // Add the new one
  html.classList.add(id)
}

export const ThemeProvider: ParentComponent = (props) => {
  const [theme, setThemeSignal] = createSignal<ThemeId>(DEFAULT_THEME)

  onMount(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null
    const initial = saved && THEMES.some(t => t.id === saved) ? saved : DEFAULT_THEME
    setThemeSignal(initial)
    applyTheme(initial)
  })

  const setTheme = (id: ThemeId) => {
    setThemeSignal(id)
    applyTheme(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {props.children}
    </ThemeContext.Provider>
  )
}
