export async function exportPdf(opts: {
  title: string
  meta?: string
  contentId: string
  filename: string
}) {
  const contentEl = document.getElementById(opts.contentId)
  if (!contentEl) {
    console.error('PDF export: element not found', opts.contentId)
    return
  }

  let html2pdf: any
  try {
    const mod = await import('html2pdf.js')
    html2pdf = mod.default || mod
  } catch (e) {
    console.error('Failed to load html2pdf', e)
    alert('PDF export failed to load')
    return
  }

  const contentClone = contentEl.cloneNode(true) as HTMLElement
  contentClone.removeAttribute('class')
  contentClone.querySelectorAll('[class]').forEach((el: Element) => el.removeAttribute('class'))

  // Reset ALL browser default margins/paddings before applying our own styles
  contentClone.querySelectorAll('*').forEach((el: Element) => {
    const hel = el as HTMLElement
    hel.style.margin = '0'
    hel.style.padding = '0'
  })

  contentClone.querySelectorAll('img').forEach((img: HTMLImageElement) => {
    const src = img.getAttribute('src')
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      img.src = window.location.origin + '/' + src.replace(/^\/+/, '')
    }
    img.crossOrigin = 'anonymous'
  })

  const container = document.createElement('div')
  container.style.cssText = `
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
    color: #1a1a2a; line-height: 1.8; font-size: 14px;
  `

  // Title
  const titleEl = document.createElement('h1')
  titleEl.textContent = opts.title
  titleEl.style.cssText = 'font-size: 22px; font-weight: 700; color: #111; margin: 0 0 6px 0; padding-bottom: 8px; border-bottom: 2px solid #00cc6a;'
  container.appendChild(titleEl)

  // Meta line
  if (opts.meta) {
    const metaEl = document.createElement('p')
    metaEl.textContent = opts.meta
    metaEl.style.cssText = 'font-size: 11px; color: #999; margin: 0 0 20px 0; font-family: monospace;'
    container.appendChild(metaEl)
  }

  contentClone.style.cssText = 'font-size: 14px; line-height: 1.8; color: #222;'
  applyCleanStyles(contentClone)
  container.appendChild(contentClone)

  // Temporarily add to DOM
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 780px; background: white;'
  wrapper.appendChild(container)
  document.body.appendChild(wrapper)

  try {
    await html2pdf().set({
      margin: [15, 15, 15, 15],
      filename: opts.filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).from(container).save()
  } catch (e) {
    console.error('PDF generation failed', e)
    alert('PDF export failed: ' + (e as Error).message)
  } finally {
    document.body.removeChild(wrapper)
  }
}

function applyCleanStyles(el: HTMLElement) {
  el.querySelectorAll('h1').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'font-size: 20px; font-weight: 700; color: #111; margin-top: 24px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e0e0e0;'
  })
  el.querySelectorAll('h2').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'font-size: 17px; font-weight: 700; color: #00884a; margin-top: 20px; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #e8e8e8;'
  })
  el.querySelectorAll('h3').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'font-size: 15px; font-weight: 600; color: #1a6baa; margin-top: 16px; margin-bottom: 4px;'
  })
  el.querySelectorAll('h4, h5, h6').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'font-size: 14px; font-weight: 600; color: #333; margin-top: 12px; margin-bottom: 0;'
  })
  el.querySelectorAll('p').forEach((e: Element) => {
    const hel = e as HTMLElement
    if (hel.querySelector('img') && !hel.textContent?.trim()) {
      hel.style.cssText = 'margin: 0;'
    } else {
      hel.style.cssText = 'color: #333; line-height: 1.8; margin: 0 0 10px 0;'
    }
  })
  el.querySelectorAll('ul').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'list-style-type: disc; padding-left: 24px; margin: 6px 0; color: #333;'
  })
  el.querySelectorAll('ol').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'list-style-type: decimal; padding-left: 24px; margin: 6px 0; color: #333;'
  })
  el.querySelectorAll('li').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'margin-bottom: 2px; color: #333; line-height: 1.7;'
  })
  el.querySelectorAll('pre').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'background: #f4f4f8; color: #333; padding: 12px 14px; border-radius: 6px; font-size: 12px; font-family: "SF Mono", "Fira Code", "Courier New", monospace; overflow-x: auto; margin: 10px 0; border: 1px solid #e0e0e0; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;'
  })
  el.querySelectorAll('code').forEach((e: Element) => {
    const hel = e as HTMLElement
    if (hel.parentElement?.tagName !== 'PRE') {
      hel.style.cssText = 'background: #f0f0f5; padding: 1px 5px; border-radius: 3px; font-size: 13px; font-family: "SF Mono", "Courier New", monospace; color: #c7254e;'
    } else {
      hel.style.cssText = 'background: transparent; padding: 0; font-size: 12px; color: #333;'
    }
  })
  el.querySelectorAll('blockquote').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'border-left: 3px solid #00cc6a; padding-left: 12px; margin: 10px 0; color: #555; font-style: italic;'
  })
  el.querySelectorAll('table').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px;'
  })
  el.querySelectorAll('th').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'border: 1px solid #ddd; padding: 6px 10px; text-align: left; background: #f5f5f5; font-weight: 600; color: #333;'
  })
  el.querySelectorAll('td').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'border: 1px solid #ddd; padding: 6px 10px; text-align: left; color: #333;'
  })
  el.querySelectorAll('img').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'max-width: 100%; height: auto; margin: 4px 0 8px 0; display: block;'
  })
  el.querySelectorAll('a').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'color: #0066cc; text-decoration: underline;'
  })
  el.querySelectorAll('strong').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'font-weight: 700; color: #111;'
  })
  el.querySelectorAll('hr').forEach((e: Element) => {
    (e as HTMLElement).style.cssText = 'border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;'
  })
  el.querySelectorAll('p').forEach((e: Element) => {
    if (!e.textContent?.trim() && !e.querySelector('img')) e.remove()
  })
  el.querySelectorAll('span[class*="hljs"]').forEach((e: Element) => {
    (e as HTMLElement).removeAttribute('class')
  })
}
