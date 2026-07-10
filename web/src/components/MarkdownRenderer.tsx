import { onMount } from 'solid-js'
import { marked } from 'marked'
import hljs from 'highlight.js'
import { request } from '../api/client'

declare const WaveDrom: any
declare const mermaid: any

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

// --- DTS Chip Architecture Visualization (Flat Peripheral Map) ---

interface DTSPERIPHERAL {
  name: string
  label: string
  status: 'okay' | 'disabled'
  address: number
  addressStr: string
}

const DTS_SKIP_NAMES = new Set([
  'aliases', 'chosen', '__symbols__', 'firmware', 'psci', 'timer',
  'reserved-memory', 'memory@0', 'test-power', 'minidump',
  'rockchip-suspend', 'rockchip-system-monitor', 'fiq-debugger',
  'mpp-srv', 'display-subsystem', 'power-management@fd8d8000',
  'hwspinlock@fe5a0000', 'rkvtunnel', 'decompress@fea80000',
  'dfi@fe060000', 'avsd-plus@fdb51000', 'iommu-demo@fdb90000',
  'adc-keys', 'leds', 'bt-sco', 'wireless-bluetooth', 'wireless-wlan',
])

const DTS_SKIP_PATTERNS = [/^iommu@/, /^qos@/, /^syscon@fd[6-9a-f]/i, /^debug@/, /^uio@/, /^pvtm@/]

function parseDTSAliases(text: string): Map<string, string> {
  const result = new Map<string, string>()
  const m = text.match(/aliases\s*\{([^}]+)\}/s)
  if (m) {
    for (const line of m[1].split('\n')) {
      const am = line.trim().match(/^([\w]+)\s*=\s*"([^"]+)"/)
      if (am) result.set(am[2], am[1])
    }
  }
  return result
}

function makePeriphLabel(name: string, alias: string): string {
  if (alias) {
    const tm = alias.match(/^([a-z]+?)(\d+)$/)
    if (tm) {
      const typeMap: Record<string, string> = {
        serial: 'UART', i2c: 'I2C', spi: 'SPI', pwm: 'PWM',
        gpio: 'GPIO', ethernet: 'ETH', mmc: 'MMC',
        hdmi: 'HDMI', dp: 'DP', edp: 'eDP', dsi: 'DSI',
      }
      return (typeMap[tm[1]] || tm[1].toUpperCase()) + ' ' + tm[2]
    }
    return alias
  }
  const prefix = name.split('@')[0]
  return prefix.charAt(0).toUpperCase() + prefix.slice(1).replace(/[-_]/g, ' ')
}

// Detect PHY ↔ Controller connections
function detectPeriphConnections(periphs: DTSPERIPHERAL[]): [number, number][] {
  const conns: [number, number][] = []

  // Match by name pairs: hdmi↔hdmiphy, usb↔phy@fed8/9, dp↔hdptx, dsi↔dphy
  const pairPatterns: [RegExp, RegExp][] = [
    [/^hdmi@fde8/, /^hdmiphy@fed6/],
    [/^hdmi@fdea/, /^hdmiphy@fed7/],
    [/^usb@fc80/, /^phy@fed8/],
    [/^usb@fc84/, /^phy@fed9/],
    [/^usb@fc88/, /^usbdp0/],
    [/^usb@fc8c/, /^usbdp1/],
    [/^dp@fde5/, /^hdptx0|^phy@fed6/],
    [/^dp@fde6/, /^hdptx1|^phy@fed7/],
    [/^dsi@fde2/, /^csi2-dphy0/],
    [/^dsi@fde3/, /^csi2-dphy1/],
    [/^sata@fe21/, /^phy@feda/],
    [/^sata@fe22/, /^phy@fedb/],
    [/^sata@fe23/, /^phy@fee0/],
    [/^pcie@fe15/, /^phy@fee1/],
    [/^pcie@fe17/, /^phy@fee2/],
    [/^ethernet@fe1b/, /^phy@fee8/],
    [/^ethernet@fe1c/, /^phy@fee8/],
  ]

  for (const [p1, p2] of pairPatterns) {
    const i1 = periphs.findIndex(p => p1.test(p.name))
    const i2 = periphs.findIndex(p => p2.test(p.name))
    if (i1 >= 0 && i2 >= 0) conns.push([i1, i2])
  }

  return conns
}

function parseDTSPeripherals(text: string): { model: string; compatible: string; periphs: DTSPERIPHERAL[] } {
  const aliases = parseDTSAliases(text)
  const modelM = text.match(/model\s*=\s*"([^"]+)"/)
  const compatM = text.match(/compatible\s*=\s*"([^"]+)"/)
  const lines = text.split('\n')
  const periphs: DTSPERIPHERAL[] = []
  let inRoot = false
  let braceDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim()
    if (stripped.startsWith('/ {') || stripped === '/{') { inRoot = true; braceDepth = 1; continue }
    if (!inRoot) continue
    braceDepth += (stripped.match(/{/g) || []).length - (stripped.match(/}/g) || []).length
    if (braceDepth <= 0) break
    if (!lines[i].startsWith('\t') || lines[i].startsWith('\t\t')) continue
    const nm = stripped.match(/^([a-zA-Z0-9@,.\-#/+_]+)\s*[{;/]/)
    if (!nm) continue
    const name = nm[1]
    if (DTS_SKIP_NAMES.has(name)) continue
    if (DTS_SKIP_PATTERNS.some(p => p.test(name))) continue

    let status: 'okay' | 'disabled' = 'okay'
    for (let j = i + 1; j < Math.min(i + 60, lines.length); j++) {
      const s = lines[j].trim()
      const sm = s.match(/status\s*=\s*"(\w+)"/)
      if (sm) { status = sm[1] as 'okay' | 'disabled'; break }
      if (lines[j].startsWith('\t}') || lines[j].startsWith('\t};')) break
    }

    const path = '/' + name
    const alias = aliases.get(path) || ''
    const addrMatch = name.match(/@([0-9a-f]+)/i)
    const address = addrMatch ? parseInt(addrMatch[1], 16) : 0xFFFFFFFF
    const addressStr = addrMatch ? '0x' + addrMatch[1] : ''

    periphs.push({ name, label: makePeriphLabel(name, alias), status, address, addressStr })
  }

  // Sort by address
  periphs.sort((a, b) => a.address - b.address)

  return { model: modelM ? modelM[1] : 'Unknown SoC', compatible: compatM ? compatM[1] : '', periphs }
}

function renderDTSChipView(codeEl: HTMLElement) {
  const text = codeEl.textContent || ''
  const { model, compatible, periphs } = parseDTSPeripherals(text)
  const enabledCount = periphs.filter(p => p.status === 'okay').length
  const disabledCount = periphs.filter(p => p.status === 'disabled').length
  const NS = 'http://www.w3.org/2000/svg'

  function makeEl(tag: string, attrs?: Record<string, string | number>): SVGElement {
    const e = document.createElementNS(NS, tag)
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
    return e
  }

  // --- Wrapper ---
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'margin:12px 0;border:1px solid rgb(var(--color-border) / 0.3);border-radius:12px;overflow:hidden;background:rgb(var(--color-card))'

  // --- Header ---
  const header = document.createElement('div')
  header.style.cssText = 'padding:10px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;border-bottom:1px solid rgb(var(--color-border) / 0.2)'
  const titleEl = document.createElement('div')
  titleEl.style.cssText = 'font-size:14px;font-weight:600;color:rgb(var(--color-accent))'
  titleEl.textContent = model
  header.appendChild(titleEl)
  if (compatible) {
    const compatEl = document.createElement('span')
    compatEl.style.cssText = 'font-size:10px;color:rgb(var(--color-secondary) / 0.4);margin-left:8px;font-family:"JetBrains Mono",monospace'
    compatEl.textContent = compatible.split('\0')[0]
    titleEl.appendChild(compatEl)
  }
  const statsEl = document.createElement('div')
  statsEl.style.cssText = 'display:flex;gap:6px;align-items:center'
  const eb = document.createElement('span')
  eb.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:10px;background:rgb(var(--color-accent) / 0.15);color:rgb(var(--color-accent))'
  eb.textContent = `${enabledCount} enabled`
  statsEl.appendChild(eb)
  const db = document.createElement('span')
  db.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:10px;background:rgb(var(--color-secondary) / 0.1);color:rgb(var(--color-secondary) / 0.4)'
  db.textContent = `${disabledCount} disabled`
  statsEl.appendChild(db)
  header.appendChild(statsEl)
  wrapper.appendChild(header)

  // --- SVG Layout ---
  const VW = 960
  const BW = 108   // block width
  const BH = 38    // block height
  const GAP = 5
  const COLS = Math.floor((VW - 20) / (BW + GAP))
  const rows = Math.ceil(periphs.length / COLS)
  const svgH = rows * (BH + GAP) + 30

  const svg = makeEl('svg', { viewBox: `0 0 ${VW} ${svgH}`, width: '100%' })
  svg.style.cssText = 'display:block;font-family:"JetBrains Mono",monospace'

  // Chip outline
  svg.appendChild(makeEl('rect', { x: 3, y: 2, width: VW - 6, height: svgH - 4, rx: 10, fill: 'rgb(var(--color-surface))', stroke: 'rgb(var(--color-border) / 0.15)', 'stroke-width': 1 }))

  // Connection lines layer (behind blocks)
  const connLayer = makeEl('g')
  svg.appendChild(connLayer)

  // Calculate block positions
  type Pos = { x: number; y: number; col: number; row: number }
  const positions: Pos[] = periphs.map((_, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    return {
      x: 10 + col * (BW + GAP),
      y: 12 + row * (BH + GAP),
      col,
      row,
    }
  })

  // --- Draw connection lines (PHY ↔ Controller) ---
  const connections = detectPeriphConnections(periphs)
  for (const [i1, i2] of connections) {
    const p1 = positions[i1]
    const p2 = positions[i2]
    if (!p1 || !p2) continue
    const x1 = p1.x + BW / 2
    const y1 = p1.y + BH / 2
    const x2 = p2.x + BW / 2
    const y2 = p2.y + BH / 2

    // Draw as a subtle curved path
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2
    connLayer.appendChild(makeEl('path', {
      d: `M${x1},${y1} Q${midX + (y2 > y1 ? 20 : -20)},${midY} ${x2},${y2}`,
      fill: 'none',
      stroke: 'rgb(var(--color-secondary) / 0.2)',
      'stroke-width': 1,
      'stroke-dasharray': '3,2',
    }))
  }

  // --- Draw peripheral blocks ---
  for (let i = 0; i < periphs.length; i++) {
    const p = periphs[i]
    const { x, y } = positions[i]
    const isOkay = p.status === 'okay'

    const g = makeEl('g')
    g.style.cursor = 'pointer'

    // Block rect
    const fill = isOkay
      ? 'rgb(var(--color-accent) / 0.08)'
      : 'rgb(var(--color-text) / 0.02)'
    const stroke = isOkay
      ? 'rgb(var(--color-accent) / 0.4)'
      : 'rgb(var(--color-border) / 0.15)'

    g.appendChild(makeEl('rect', { x, y, width: BW, height: BH, rx: 5, fill, stroke, 'stroke-width': 1.2 }))

    // Status indicator bar at left edge
    const barColor = isOkay ? 'rgb(var(--color-accent))' : 'rgb(var(--color-border) / 0.3)'
    g.appendChild(makeEl('rect', { x, y: y + 5, width: 3, height: BH - 10, rx: 1.5, fill: barColor }))

    // Label text
    const textColor = isOkay ? 'rgb(var(--color-text) / 0.85)' : 'rgb(var(--color-text) / 0.25)'
    const label = makeEl('text', { x: x + 9, y: y + 15, fill: textColor, 'font-size': 10.5, 'font-weight': isOkay ? 500 : 400 })
    label.textContent = p.label
    g.appendChild(label)

    // Address text
    const addrColor = isOkay ? 'rgb(var(--color-accent) / 0.5)' : 'rgb(var(--color-text) / 0.15)'
    const addr = makeEl('text', { x: x + 9, y: y + 29, fill: addrColor, 'font-size': 8.5 })
    addr.textContent = p.addressStr
    g.appendChild(addr)

    // Hover highlight
    const origFill = fill
    const origStroke = stroke
    g.onmouseenter = () => {
      g.querySelector('rect')?.setAttribute('fill', isOkay ? 'rgb(var(--color-accent) / 0.15)' : 'rgb(var(--color-text) / 0.04)')
      g.querySelector('rect')?.setAttribute('stroke', 'rgb(var(--color-accent) / 0.6)')
    }
    g.onmouseleave = () => {
      g.querySelector('rect')?.setAttribute('fill', origFill)
      g.querySelector('rect')?.setAttribute('stroke', origStroke)
    }

    svg.appendChild(g)
  }

  wrapper.appendChild(svg)
  codeEl.parentElement?.replaceWith(wrapper)
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

    // Render mermaid code blocks
    const mermaidBlocks = ref.querySelectorAll('pre code.language-mermaid')
    if (mermaidBlocks.length > 0) {
      const loadAndRenderMermaid = async () => {
        // Load mermaid library if not yet loaded
        if (typeof mermaid === 'undefined') {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = '/vditor/js/mermaid/mermaid.min.js'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load mermaid'))
            document.head.appendChild(script)
          })
          mermaid.initialize({
            securityLevel: 'loose',
            startOnLoad: false,
            theme: 'dark',
            flowchart: { htmlLabels: true, useMaxWidth: true },
            sequence: { useMaxWidth: true, diagramMarginX: 8, diagramMarginY: 8, boxMargin: 8, showSequenceNumbers: true },
          })
        }
        for (const block of mermaidBlocks) {
          const el = block as HTMLElement
          if (el.getAttribute('data-processed') === 'true') continue
          const code = el.textContent || ''
          if (code.trim() === '') continue
          // Extract custom title from first line: %% title: xxx
          const titleMatch = code.match(/^%%\s*title\s*:\s*(.+)/m)
          const diagramTitle = titleMatch ? titleMatch[1].trim() : 'Mermaid'
          try {
            const id = 'mermaid-' + Math.random().toString(36).slice(2)
            const { svg } = await mermaid.render(id, code)
            // Measure SVG height to decide if collapsible
            const measure = document.createElement('div')
            measure.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
            measure.innerHTML = svg
            document.body.appendChild(measure)
            const svgHeight = measure.querySelector('svg')?.getBoundingClientRect().height || 0
            document.body.removeChild(measure)

            const COLLAPSED_HEIGHT = 220
            const needsCollapse = svgHeight > COLLAPSED_HEIGHT + 40

            // Wrapper with border + card bg
            const wrapper = document.createElement('div')
            wrapper.style.cssText = 'margin:12px 0;border:1px solid rgb(var(--color-border) / 0.3);border-radius:8px;overflow:hidden;background:rgb(var(--color-card))'

            // Header bar
            const header = document.createElement('div')
            header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:rgb(var(--color-surface));border-bottom:1px solid rgb(var(--color-border) / 0.2);cursor:pointer;user-select:none;transition:background 0.15s'
            const label = document.createElement('span')
            label.style.cssText = 'font-size:12px;color:rgb(var(--color-accent) / 0.8);font-family:"JetBrains Mono",monospace'
            label.textContent = diagramTitle
            const toggleBtn = document.createElement('span')
            toggleBtn.style.cssText = 'font-size:11px;color:rgb(var(--color-text) / 0.4);transition:transform 0.2s'
            toggleBtn.textContent = '▼'

            header.appendChild(label)
            if (needsCollapse) header.appendChild(toggleBtn)
            header.onmouseenter = () => header.style.background = 'rgb(var(--color-accent) / 0.05)'
            header.onmouseleave = () => header.style.background = 'rgb(var(--color-surface))'
            wrapper.appendChild(header)

            // Body: holds shadow DOM host
            const body = document.createElement('div')
            body.style.cssText = 'position:relative;transition:max-height 0.3s ease;overflow:hidden'

            // Shadow DOM host for SVG isolation
            const host = document.createElement('div')
            host.style.cssText = 'display:block;overflow:auto;text-align:center'
            const shadow = host.attachShadow({ mode: 'open' })
            shadow.innerHTML = svg
            body.appendChild(host)

            // Collapse logic
            if (needsCollapse) {
              body.style.maxHeight = COLLAPSED_HEIGHT + 'px'
              // Gradient fade overlay
              const fade = document.createElement('div')
              fade.style.cssText = `position:absolute;bottom:0;left:0;right:0;height:60px;background:linear-gradient(transparent, rgb(var(--color-card)));pointer-events:none`
              body.appendChild(fade)

              let expanded = false
              header.onclick = () => {
                expanded = !expanded
                if (expanded) {
                  body.style.maxHeight = 'none'
                  fade.style.display = 'none'
                  toggleBtn.textContent = '▲'
                } else {
                  body.style.maxHeight = COLLAPSED_HEIGHT + 'px'
                  fade.style.display = ''
                  toggleBtn.textContent = '▼'
                }
              }
            }

            wrapper.appendChild(body)
            el.parentElement?.replaceWith(wrapper)
          } catch (e: any) {
            console.warn('Mermaid render error:', e)
            // Show error inline
            const errDiv = document.createElement('div')
            errDiv.style.cssText = 'margin:12px 0;padding:12px;border:1px solid rgb(var(--color-danger) / 0.3);border-radius:8px;color:rgb(var(--color-danger));font-size:13px'
            errDiv.textContent = 'Mermaid render error: ' + (e.message || e)
            el.parentElement?.replaceWith(errDiv)
          }
          el.setAttribute('data-processed', 'true')
        }
      }
      loadAndRenderMermaid()
    }

    // Highlight code blocks
    ref.querySelectorAll('pre code').forEach((block) => {
      const el = block as HTMLElement
      // Skip mermaid blocks — already rendered above
      if (el.classList.contains('language-mermaid')) {
        return
      }
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
      // DTS chip architecture visualization
      if (el.classList.contains('language-dts') || el.classList.contains('language-dtsi')) {
        try {
          renderDTSChipView(el)
        } catch (e) {
          console.warn('DTS render error:', e)
          hljs.highlightElement(el)
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
