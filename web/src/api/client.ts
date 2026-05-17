const BASE = '/api'

let authHeader = ''

export function setCredentials(user: string, pass: string) {
  authHeader = 'Basic ' + btoa(user + ':' + pass)
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

// Stats
export const stats = () => request('/stats')
