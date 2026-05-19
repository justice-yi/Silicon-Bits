/**
 * Copy wiki content as rich HTML to clipboard, suitable for pasting into
 * WeChat Official Account editor. WeChat supports inline-styled HTML.
 */
export async function copyForWeChat(opts: {
  title: string
  contentId: string
}) {
  const contentEl = document.getElementById(opts.contentId)
  if (!contentEl) {
    alert('Content not found')
    return
  }

  // Clone the rendered markdown content
  const clone = contentEl.cloneNode(true) as HTMLElement

  // Remove all classes (dark theme styles)
  clone.removeAttribute('class')
  clone.querySelectorAll('[class]').forEach((el: Element) => el.removeAttribute('class'))

  // Build the HTML with WeChat-friendly inline styles
  const container = document.createElement('div')
  container.style.cssText = 'font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif; color: #333; font-size: 16px; line-height: 2; max-width: 677px;'

  // Don't include title in content — WeChat has a separate title field
  // User should paste title manually from the prompt

  // Apply WeChat-friendly styles to cloned content
  clone.style.cssText = 'font-size: 16px; line-height: 2; color: #333;'

  // Headings
  clone.querySelectorAll('h1').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'font-size: 20px; font-weight: bold; color: #111; margin: 24px 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 6px;'
  })
  clone.querySelectorAll('h2').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'font-size: 18px; font-weight: bold; color: #1a1a1a; margin: 20px 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 4px;'
  })
  clone.querySelectorAll('h3').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'font-size: 17px; font-weight: bold; color: #333; margin: 16px 0 6px 0;'
  })
  clone.querySelectorAll('h4, h5, h6').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'font-size: 16px; font-weight: bold; color: #333; margin: 14px 0 6px 0;'
  })

  // Paragraphs
  clone.querySelectorAll('p').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'margin: 10px 0; line-height: 2; color: #333; font-size: 16px;'
  })

  // Images - WeChat needs absolute URLs
  clone.querySelectorAll('img').forEach((img: HTMLImageElement) => {
    const src = img.getAttribute('src')
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      img.src = window.location.origin + '/' + src.replace(/^\/+/, '')
    }
    img.style.cssText = 'max-width: 100%; height: auto; display: block; margin: 10px auto; border-radius: 4px;'
    img.removeAttribute('width')
    img.removeAttribute('height')
  })

  // Code blocks
  clone.querySelectorAll('pre').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'background: #f6f8fa; padding: 16px; border-radius: 6px; font-size: 14px; line-height: 1.6; overflow-x: auto; margin: 10px 0; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;'
  })
  clone.querySelectorAll('code').forEach((el: Element) => {
    const hel = el as HTMLElement
    if (hel.parentElement?.tagName !== 'PRE') {
      hel.style.cssText = 'background: #fff5f5; color: #c7254e; padding: 2px 6px; border-radius: 3px; font-size: 14px; font-family: Menlo, Monaco, monospace;'
    } else {
      hel.style.cssText = 'background: transparent; font-size: 14px; color: #333;'
    }
  })

  // Blockquotes
  clone.querySelectorAll('blockquote').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'border-left: 4px solid #00cc6a; padding: 10px 16px; margin: 10px 0; background: #f8f8f8; color: #666; font-size: 15px;'
  })

  // Tables
  clone.querySelectorAll('table').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 15px;'
  })
  clone.querySelectorAll('th').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'border: 1px solid #ddd; padding: 8px 12px; background: #f5f5f5; font-weight: bold; color: #333; text-align: left;'
  })
  clone.querySelectorAll('td').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'border: 1px solid #ddd; padding: 8px 12px; color: #333; text-align: left;'
  })

  // Lists
  clone.querySelectorAll('ul, ol').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'padding-left: 24px; margin: 8px 0; color: #333;'
  })
  clone.querySelectorAll('li').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'margin: 4px 0; line-height: 1.8; color: #333;'
  })

  // Links
  clone.querySelectorAll('a').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'color: #576b95; text-decoration: none;'
  })

  // Strong
  clone.querySelectorAll('strong').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'font-weight: bold; color: #111;'
  })

  // HR
  clone.querySelectorAll('hr').forEach((el: Element) => {
    (el as HTMLElement).style.cssText = 'border: none; border-top: 1px solid #eee; margin: 20px 0;'
  })

  container.appendChild(clone)

  // Copy rich HTML to clipboard
  try {
    const htmlBlob = new Blob([container.outerHTML], { type: 'text/html' })
    const textBlob = new Blob([container.textContent || ''], { type: 'text/plain' })
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      })
    ])
    prompt('Content copied! Paste (Ctrl+V) into WeChat editor.\n\nTitle (copy this to WeChat title field):', opts.title)
  } catch (e) {
    // Fallback: select and copy
    const wrapper = document.createElement('div')
    wrapper.style.cssText = 'position: fixed; left: -9999px; top: 0;'
    wrapper.appendChild(container)
    document.body.appendChild(wrapper)

    const range = document.createRange()
    range.selectNodeContents(container)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    document.execCommand('copy')
    sel?.removeAllRanges()
    document.body.removeChild(wrapper)
    prompt('Content copied! Paste (Ctrl+V) into WeChat editor.\n\nTitle (copy this to WeChat title field):', opts.title)
  }
}
