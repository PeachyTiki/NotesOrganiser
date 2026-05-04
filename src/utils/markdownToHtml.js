// Convert markdown text to HTML for use in the rich text editor.
// If the input already looks like HTML it is returned unchanged.
export function markdownToHtml(text) {
  if (!text || typeof text !== 'string') return ''
  const t = text.trim()
  if (!t) return ''
  if (t.startsWith('<')) return t   // already HTML

  const inline = (str) =>
    str
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="font-family:monospace;background:#f1f5f9;padding:0 3px;border-radius:3px">$1</code>')

  const lines = text.split('\n')
  const out = []
  let inUl = false
  let inOl = false

  const closeUl = () => { if (inUl) { out.push('</ul>'); inUl = false } }
  const closeOl = () => { if (inOl) { out.push('</ol>'); inOl = false } }
  const closeLists = () => { closeUl(); closeOl() }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (/^#{1,6} /.test(line)) {
      closeLists()
      const level = line.match(/^(#+)/)[1].length
      const content = inline(line.replace(/^#+\s+/, ''))
      const sizes = ['', '1.4em', '1.25em', '1.1em', '1em', '0.9em', '0.85em']
      out.push(`<h${level} style="font-weight:600;font-size:${sizes[level]};margin:0.4em 0 0.2em">${content}</h${level}>`)
      continue
    }

    if (/^- \[[xX]\] /.test(line)) {
      if (!inUl) { closeLists(); inUl = true; out.push('<ul style="list-style:none;padding-left:1.2em;margin:0.2em 0">') }
      out.push(`<li>☑ <span style="text-decoration:line-through;color:#94a3b8">${inline(line.replace(/^- \[[xX]\] /, ''))}</span></li>`)
      continue
    }

    if (/^- \[ \] /.test(line)) {
      if (!inUl) { closeLists(); inUl = true; out.push('<ul style="list-style:none;padding-left:1.2em;margin:0.2em 0">') }
      out.push(`<li>☐ ${inline(line.replace(/^- \[ \] /, ''))}</li>`)
      continue
    }

    if (/^[-*] /.test(line)) {
      if (!inUl) { closeLists(); inUl = true; out.push('<ul style="padding-left:1.5em;margin:0.2em 0">') }
      out.push(`<li>${inline(line.replace(/^[-*] /, ''))}</li>`)
      continue
    }

    if (/^\d+\. /.test(line)) {
      if (!inOl) { closeLists(); inOl = true; out.push('<ol style="padding-left:1.5em;margin:0.2em 0">') }
      out.push(`<li>${inline(line.replace(/^\d+\. /, ''))}</li>`)
      continue
    }

    closeLists()
    if (line === '') {
      out.push('<div style="height:0.4em"></div>')
    } else if (/^---+$/.test(line)) {
      out.push('<hr style="border:none;border-top:1px solid #e2e8f0;margin:0.5em 0">')
    } else {
      out.push(`<p style="margin:0.1em 0">${inline(line)}</p>`)
    }
  }

  closeLists()
  return out.join('')
}

// Strip HTML tags back to plain text — used by PDF/Word exporters so they
// can handle both old markdown content and new HTML content from the editor.
export function htmlToPlainText(html) {
  if (!html || typeof html !== 'string') return html || ''
  if (!html.includes('<')) return html   // already plain text
  return html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (_, t) => t.replace(/<[^>]+>/g, '') + '\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '$1')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '$1')
    .replace(/<u[^>]*>(.*?)<\/u>/gi, '$1')
    .replace(/<s[^>]*>(.*?)<\/s>/gi, '$1')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, (_, t) => '- ' + t.replace(/<[^>]+>/g, '') + '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
