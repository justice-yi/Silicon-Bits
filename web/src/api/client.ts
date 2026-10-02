const BASE = '/api'
const AUTH_KEY = 'sb_auth'

let authHeader = ''

// Restore the session on page load so a refresh doesn't kick the user back
// to the login screen. (localStorage keeps the Basic header itself — fine
// for a single-user personal tool.)
try {
  authHeader = localStorage.getItem(AUTH_KEY) || ''
} catch { /* storage unavailable (private mode) — stay memory-only */ }

// btoa() only accepts Latin-1; encode credentials as UTF-8 bytes first so
// non-ASCII usernames/passwords don't crash the login handler.
function utf8Base64(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)))
}

export function setCredentials(user: string, pass: string) {
  if (user === '' && pass === '') {
    authHeader = ''
    try { localStorage.removeItem(AUTH_KEY) } catch {}
    return
  }
  authHeader = 'Basic ' + utf8Base64(user + ':' + pass)
  try { localStorage.setItem(AUTH_KEY, authHeader) } catch {}
}

export function logout() {
  setCredentials('', '')
}

export function getCredentials(): string | null {
  return authHeader || null
}

export async function request(path: string, opts: RequestInit = {}) {
  const headers: any = { ...opts.headers }
  if (authHeader) headers['Authorization'] = authHeader
  if (opts.body && typeof opts.body === 'string') headers['Content-Type'] = 'application/json'

  const res = await fetch(BASE + path, { ...opts, headers })
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  if (res.headers.get('content-type')?.includes('application/json')) {
    return res.json()
  }
  return res
}

// Bug APIs
export const bugs = {
  list: (params?: string) => request('/bugs' + (params ? '?' + params : '')),
  get: (id: number) => request(`/bugs/${id}`),
  create: (data: any) => request('/bugs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => request(`/bugs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/bugs/${id}`, { method: 'DELETE' }),
  link: (id: number, data: any) => request(`/bugs/${id}/links`, { method: 'POST', body: JSON.stringify(data) }),
  unlink: (id: number, targetId: number, type: string) => request(`/bugs/${id}/links/${targetId}?type=${type}`, { method: 'DELETE' }),
  exportBug: (id: number) => request(`/bugs/${id}/export?format=md`),
}

// Wiki APIs
export const wikis = {
  list: (params?: string) => request('/wikis' + (params ? '?' + params : '')),
  get: (id: number) => request(`/wikis/${id}`),
  create: (data: any) => request('/wikis', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => request(`/wikis/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/wikis/${id}`, { method: 'DELETE' }),
  importBatch: (data: any[]) => request('/wikis/import', { method: 'POST', body: JSON.stringify(data) }),
  exportWiki: (id: number) => request(`/wikis/${id}/export?format=md`),
}

// Search
export const search = (q: string, type = 'all') => request(`/search?q=${encodeURIComponent(q)}&type=${type}`)

// BSP Tree
export const bspTree = () => request('/bsp/tree')
export const bspModules = {
  create: (data: any) => request('/bsp/modules', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => request(`/bsp/modules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/bsp/modules/${id}`, { method: 'DELETE' }),
}

// Stats
export const stats = () => request('/stats')
