import jsPDF from 'jspdf'

const PW = 210, PH = 297
const ML = 15, MR = 15, MT = 15, MB = 18
const CW = PW - ML - MR  // 180mm

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Encapsulates jsPDF and current Y cursor, auto-adds pages
class PageBuilder {
  constructor(pdf, accentRgb) {
    this.pdf = pdf
    this.y = MT
    this.accent = accentRgb
  }

  needsPage(mm) {
    if (this.y + mm > PH - MB) { this.pdf.addPage(); this.y = MT; return true }
    return false
  }

  rule(colorRgb = [226, 232, 240]) {
    this.pdf.setDrawColor(...colorRgb)
    this.pdf.setLineWidth(0.2)
    this.pdf.line(ML, this.y, PW - MR, this.y)
    this.y += 3
  }

  sp(mm) { this.y += mm }

  text(str, x, fontSize, fontStyle, colorRgb, lineH = 5.5) {
    if (!str) return
    this.pdf.setFontSize(fontSize)
    this.pdf.setFont('helvetica', fontStyle)
    this.pdf.setTextColor(...colorRgb)
    const maxW = CW - (x - ML)
    const lines = this.pdf.splitTextToSize(str, maxW)
    this.needsPage(lines.length * lineH + 2)
    this.pdf.text(lines, x, this.y)
    this.y += lines.length * lineH
  }

  // Draw a table with header + rows
  // colDefs: [{ label, widthMm, bold? }]
  // rows: [[cellString | { text, bold, badge, bg, fg }]]
  table(colDefs, rows) {
    const totalW = colDefs.reduce((s, c) => s + c.widthMm, 0)
    const hdrH = 7.5, rowH = 7, pad = 2.5

    this.needsPage(hdrH + rowH + 2)

    // Header background
    this.pdf.setFillColor(241, 245, 249)
    this.pdf.rect(ML, this.y, totalW, hdrH, 'F')
    this.pdf.setFontSize(8.5)
    this.pdf.setFont('helvetica', 'bold')
    this.pdf.setTextColor(100, 116, 139)
    let cx = ML
    colDefs.forEach((col) => {
      this.pdf.text(col.label, cx + pad, this.y + hdrH - 2.2)
      cx += col.widthMm
    })
    this.pdf.setDrawColor(203, 213, 225)
    this.pdf.setLineWidth(0.25)
    this.pdf.line(ML, this.y + hdrH, ML + totalW, this.y + hdrH)
    this.y += hdrH

    rows.forEach((row, ri) => {
      this.needsPage(rowH + 2)
      let cx = ML
      row.forEach((cell, ci) => {
        const isObj = typeof cell === 'object' && cell !== null
        const text = isObj ? (cell.text || '') : String(cell || '')
        const bold = isObj ? !!cell.bold : false
        const badge = isObj ? !!cell.badge : false
        const colW = colDefs[ci]?.widthMm || 30

        if (badge && isObj) {
          const [br, bg, bb] = hexToRgb(cell.bg || '#F1F5F9')
          const [tr, tg, tb] = hexToRgb(cell.fg || '#64748B')
          const bw = Math.min(this.pdf.getStringUnitWidth(text) * 8 / this.pdf.internal.scaleFactor + pad * 2, colW - 2)
          this.pdf.setFillColor(br, bg, bb)
          this.pdf.roundedRect(cx + pad, this.y + 1.8, bw, 4, 1, 1, 'F')
          this.pdf.setFontSize(7.5)
          this.pdf.setFont('helvetica', 'bold')
          this.pdf.setTextColor(tr, tg, tb)
          this.pdf.text(text, cx + pad + 1.5, this.y + 5)
        } else {
          this.pdf.setFontSize(9)
          this.pdf.setFont('helvetica', bold ? 'bold' : 'normal')
          this.pdf.setTextColor(bold ? 15 : 55, bold ? 23 : 65, bold ? 42 : 81)
          const lines = this.pdf.splitTextToSize(text, colW - pad * 2)
          this.pdf.text(lines[0] || '', cx + pad, this.y + 5)
        }
        cx += colW
      })

      if (ri < rows.length - 1) {
        this.pdf.setDrawColor(241, 245, 249)
        this.pdf.setLineWidth(0.1)
        this.pdf.line(ML, this.y + rowH, ML + totalW, this.y + rowH)
      }
      this.y += rowH
    })
    this.y += 5
  }

  async image(dataUrl) {
    const img = await new Promise((res) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = dataUrl
    })
    if (!img) return
    const imgW = CW
    const imgH = (img.naturalHeight / (img.naturalWidth || 1)) * imgW
    this.needsPage(Math.min(imgH, PH - MT - MB))
    this.pdf.addImage(dataUrl, 'PNG', ML, this.y, imgW, imgH)
    this.y += imgH + 4
  }
}

export async function buildPDF(note, template, chartImages, t) {
  const bannerColor = template?.bannerColor || '#E8210A'
  const [ar, ag, ab] = hexToRgb(bannerColor)
  const tFn = t || ((k) => k)
  const dateStr = fmtDate(note.date)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const b = new PageBuilder(pdf, [ar, ag, ab])

  // ── Banner ──────────────────────────────────────────────────────────────
  pdf.setFillColor(ar, ag, ab)
  pdf.rect(0, 0, PW, 14, 'F')

  if (template?.logo?.show && template?.logo?.data) {
    try {
      const logoData = template.logo.data
      const fmtMatch = logoData.match(/^data:image\/(\w+);/)
      const rawFmt = fmtMatch ? fmtMatch[1].toUpperCase() : 'PNG'
      const imgFmt = rawFmt === 'JPG' ? 'JPEG' : rawFmt
      const validFmt = ['PNG', 'JPEG', 'GIF', 'WEBP'].includes(imgFmt) ? imgFmt : 'PNG'
      const img = await new Promise((res) => {
        const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = logoData
      })
      if (img) {
        const aspect = img.naturalWidth / (img.naturalHeight || 1)
        const logoH = 10
        const logoW = Math.min(logoH * aspect, 60)
        pdf.addImage(logoData, validFmt, ML, 2, logoW, logoH)
      }
    } catch { /* skip on error */ }
  } else {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.text(tFn('meetingNotes') || 'Meeting Notes', ML, 9.5)
  }

  // ── Header strip background ──────────────────────────────────────────────
  const subtitle = [note.customer, note.eventType].filter(Boolean).join(' · ')
  const _tl = pdf.splitTextToSize(note.title || 'Untitled Meeting', CW)
  const _hdrH = 7 + _tl.length * 8.5 + (subtitle ? 4.5 : 0) + (note.team ? 5 : 0) + (dateStr ? 5 : 0) + 4
  pdf.setFillColor(248, 250, 252)
  pdf.rect(0, 14, PW, _hdrH, 'F')

  b.y = 21

  // ── Title ────────────────────────────────────────────────────────────────
  pdf.setFontSize(17)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(15, 23, 42)
  const titleLines = pdf.splitTextToSize(note.title || 'Untitled Meeting', CW)
  b.needsPage(titleLines.length * 8.5 + 4)
  pdf.text(titleLines, ML, b.y)
  b.y += titleLines.length * 8.5

  if (subtitle) { b.text(subtitle, ML, 10, 'normal', [100, 116, 139], 5.5); b.sp(-1) }
  if (note.team) { b.text(note.team, ML, 9, 'normal', [148, 163, 184], 5) }
  if (dateStr) { b.text(dateStr, ML, 9, 'normal', [148, 163, 184], 5) }

  // Bottom border of header strip
  b.sp(4)
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.3)
  pdf.line(0, b.y, PW, b.y)
  b.sp(5)

  // ── Participants ─────────────────────────────────────────────────────────
  const activeP = (note.participants || []).filter((p) => p.enabled !== false && p.name)
  if (activeP.length > 0) {
    b.needsPage(18)
    pdf.setFontSize(7.5)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(148, 163, 184)
    pdf.text(tFn('participants')?.toUpperCase() || 'PARTICIPANTS', ML, b.y)
    b.y += 4.5

    const tagH = 5, tagPad = 2.5
    let tx = ML
    let lineY = b.y

    for (const p of activeP) {
      const label = p.name + (p.role ? ` · ${p.role}` : '') + (p.firm ? ` (${p.firm})` : '')
      pdf.setFontSize(8.5)
      const tw = pdf.getTextWidth(label) + tagPad * 2
      if (tx + tw > PW - MR) { tx = ML; lineY += tagH + 2 }
      pdf.setFillColor(241, 245, 249)
      pdf.roundedRect(tx, lineY - 3.2, tw, tagH, 1.2, 1.2, 'F')
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(55, 65, 81)
      pdf.text(label, tx + tagPad, lineY)
      tx += tw + 3
    }
    b.y = lineY + tagH + 1
    b.rule(); b.sp(3)
  }

  // ── Sections ─────────────────────────────────────────────────────────────
  const STATUS_COLORS_TOPIC = {
    new:        { bg: '#F1F5F9', fg: '#64748B' },
    open:       { bg: '#EFF6FF', fg: '#2563EB' },
    inProgress: { bg: '#FFFBEB', fg: '#D97706' },
    complete:   { bg: '#F0FDF4', fg: '#16A34A' },
  }
  const STATUS_COLORS_ACTION = {
    todo:       { bg: '#F1F5F9', fg: '#64748B' },
    inProgress: { bg: '#FFFBEB', fg: '#D97706' },
    done:       { bg: '#F0FDF4', fg: '#16A34A' },
  }
  const STATUS_COLORS_SEVERITY = {
    low:      { bg: '#F0FDF4', fg: '#16A34A' },
    medium:   { bg: '#FFFBEB', fg: '#D97706' },
    high:     { bg: '#FFF7ED', fg: '#EA580C' },
    critical: { bg: '#FFF1F2', fg: '#DC2626' },
  }
  const STATUS_COLORS_RISK = {
    open:       { bg: '#EFF6FF', fg: '#2563EB' },
    monitoring: { bg: '#FFFBEB', fg: '#D97706' },
    mitigated:  { bg: '#F0FDF4', fg: '#16A34A' },
    closed:     { bg: '#F1F5F9', fg: '#64748B' },
  }

  // Tinted accent background components (88% blend toward white)
  const lrS = Math.round(ar + (255 - ar) * 0.88)
  const lgS = Math.round(ag + (255 - ag) * 0.88)
  const lbS = Math.round(ab + (255 - ab) * 0.88)

  const sections = note.sections || []
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]

    // Section label bar
    if (s.label) {
      if (i > 0) { b.sp(4); b.rule([226, 232, 240]); b.sp(3) }
      b.needsPage(14)
      // Tinted accent background fill
      pdf.setFillColor(lrS, lgS, lbS)
      pdf.rect(ML, b.y, CW, 8, 'F')
      // Accent left bar (full height of row)
      pdf.setFillColor(ar, ag, ab)
      pdf.rect(ML, b.y, 3, 8, 'F')
      // Label text
      pdf.setFontSize(10.5)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(15, 23, 42)
      pdf.text(s.label, ML + 7, b.y + 5.5)
      b.y += 11
    } else if (i > 0) {
      // No label but not the first section — add a subtle divider
      b.rule([226, 232, 240]); b.sp(2)
    }

    if (s.type === 'text' || s.type === 'notes') {
      const content = s.content || ''
      if (!content.trim() && !s.label) continue
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.startsWith('# ')) {
          b.needsPage(9); b.sp(1)
          b.text(line.slice(2), ML, 13, 'bold', [15, 23, 42], 7)
        } else if (line.startsWith('## ')) {
          b.needsPage(7); b.sp(0.5)
          b.text(line.slice(3), ML, 10.5, 'bold', [ar, ag, ab], 6)
        } else if (line.startsWith('- [ ] ') || /^- \[[xX]\] /.test(line)) {
          const checked = line[3] !== ' '
          const txt = (checked ? '☑ ' : '☐ ') + line.slice(6)
          pdf.setFontSize(9.5)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(checked ? 148 : 55, checked ? 163 : 65, checked ? 184 : 81)
          const wl = pdf.splitTextToSize(txt, CW - 4)
          b.needsPage(wl.length * 5 + 1)
          pdf.text(wl, ML + 3, b.y)
          b.y += wl.length * 5 + 1
        } else if (line.startsWith('- ')) {
          const bullet = line.slice(2)
          const wl = pdf.splitTextToSize(bullet, CW - 7)
          b.needsPage(wl.length * 5 + 1)
          pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(ar, ag, ab)
          pdf.text('•', ML + 2, b.y)
          pdf.setFont('helvetica', 'normal'); pdf.setTextColor(55, 65, 81)
          pdf.text(wl, ML + 7, b.y)
          b.y += wl.length * 5 + 1
        } else if (line === '') {
          b.y += 2.5
        } else {
          pdf.setFontSize(9.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(55, 65, 81)
          const wl = pdf.splitTextToSize(line, CW)
          b.needsPage(wl.length * 5 + 1)
          pdf.text(wl, ML, b.y)
          b.y += wl.length * 5 + 1
        }
      }
    }

    if (s.type === 'topics') {
      const items = (s.items || []).filter((item) => item.status !== 'complete')
      if (items.length === 0) continue
      const statusLabel = (st) => st === 'inProgress' ? 'In Progress' : (st ? st.charAt(0).toUpperCase() + st.slice(1) : 'New')
      b.table(
        [{ label: tFn('topic') || 'Topic', widthMm: 54 }, { label: tFn('description') || 'Description', widthMm: 90 }, { label: tFn('status') || 'Status', widthMm: 36 }],
        items.map((item) => [
          { text: item.topic || '', bold: true },
          { text: item.description || '' },
          { text: statusLabel(item.status), badge: true, ...(STATUS_COLORS_TOPIC[item.status] || STATUS_COLORS_TOPIC.new) },
        ])
      )
    }

    if (s.type === 'actionItems') {
      const items = (s.items || []).filter((item) => item.task)
      if (items.length === 0) continue
      const stLabel = (st) => st === 'inProgress' ? 'In Progress' : st === 'done' ? 'Done' : 'To do'
      b.table(
        [{ label: 'Task', widthMm: 66 }, { label: 'Assignee', widthMm: 36 }, { label: 'Due Date', widthMm: 42 }, { label: 'Status', widthMm: 36 }],
        items.map((item) => [
          { text: item.task || '', bold: true },
          { text: item.assignee || '' },
          { text: item.dueDate ? fmtDate(item.dueDate) : '' },
          { text: stLabel(item.status), badge: true, ...(STATUS_COLORS_ACTION[item.status] || STATUS_COLORS_ACTION.todo) },
        ])
      )
    }

    if (s.type === 'decisions') {
      const items = (s.items || []).filter((item) => item.decision)
      if (items.length === 0) continue
      b.table(
        [{ label: 'Decision', widthMm: 50 }, { label: 'Rationale', widthMm: 64 }, { label: 'Owner', widthMm: 36 }, { label: 'Date', widthMm: 30 }],
        items.map((item) => [
          { text: item.decision || '', bold: true },
          { text: item.rationale || '' },
          { text: item.owner || '' },
          { text: item.date ? fmtDate(item.date) : '' },
        ])
      )
    }

    if (s.type === 'risks') {
      const items = (s.items || []).filter((item) => item.risk)
      if (items.length === 0) continue
      const capFirst = (v) => v ? v.charAt(0).toUpperCase() + v.slice(1) : ''
      b.table(
        [{ label: 'Risk / Blocker', widthMm: 50 }, { label: 'Severity', widthMm: 24 }, { label: 'Owner', widthMm: 28 }, { label: 'Mitigation', widthMm: 46 }, { label: 'Status', widthMm: 26 }],
        items.map((item) => {
          const sev = item.severity || 'medium'
          const st = item.status || 'open'
          const sevColors = STATUS_COLORS_SEVERITY[sev] || STATUS_COLORS_SEVERITY.medium
          const stColors = STATUS_COLORS_RISK[st] || STATUS_COLORS_RISK.open
          return [
            { text: item.risk || '', bold: true },
            { text: capFirst(sev), badge: true, ...sevColors },
            { text: item.owner || '' },
            { text: item.mitigation || '' },
            { text: capFirst(st), badge: true, ...stColors },
          ]
        })
      )
    }

    if (s.type === 'resources') {
      const items = (s.items || []).filter((item) => item.label || item.url)
      if (items.length === 0) continue
      items.forEach((item) => {
        const displayLabel = item.label || item.url || ''
        b.text(`→  ${displayLabel}`, ML, 9.5, 'bold', [15, 23, 42])
        if (item.url && item.label) b.text(`    ${item.url}`, ML + 4, 8.5, 'normal', [37, 99, 235])
        if (item.note) b.text(`    ${item.note}`, ML + 4, 8.5, 'normal', [100, 116, 139])
        b.sp(1.5)
      })
    }

    if (['graph', 'gantt', 'pie', 'line'].includes(s.type)) {
      const imgData = chartImages?.[s.id]
      if (imgData) await b.image(imgData)
    }
  }

  // ── Footer on every page ─────────────────────────────────────────────────
  const n = pdf.internal.getNumberOfPages()
  for (let p = 1; p <= n; p++) {
    pdf.setPage(p)
    pdf.setFontSize(7.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(203, 213, 225)
    pdf.text('Notes Organiser', ML, PH - 6)
    if (dateStr) pdf.text(dateStr, PW / 2, PH - 6, { align: 'center' })
    pdf.text(`${p} / ${n}`, PW - MR, PH - 6, { align: 'right' })
  }

  return pdf
}
