import {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, ShadingType, BorderStyle,
} from 'docx'

// A4 in twips (1 inch = 1440 twips)
const PAGE_WIDTH_TWIPS  = 11906
const PAGE_HEIGHT_TWIPS = 16838
const MARGIN_TWIPS      = 851  // ~15mm

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function noBorder() {
  return { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
}

function cellBorders(bottom = true) {
  const b = { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }
  const n = noBorder()
  return { top: n, left: n, right: n, bottom: bottom ? b : n }
}

function headerCell(text) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
    borders: { top: noBorder(), left: noBorder(), right: noBorder(), bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' } },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 17, color: '64748B' })],
      spacing: { before: 40, after: 40 },
    })],
  })
}

function dataCell(content, bold = false) {
  return new TableCell({
    borders: cellBorders(),
    children: [new Paragraph({
      children: [new TextRun({ text: String(content || ''), bold, size: 19, color: bold ? '0F172A' : '374151' })],
      spacing: { before: 40, after: 40 },
    })],
  })
}

function badgeCell(text, fill = 'F1F5F9', textColor = '64748B') {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill },
    borders: cellBorders(),
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 16, color: textColor })],
      spacing: { before: 40, after: 40 },
    })],
  })
}

function makeTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h) => headerCell(h)) }),
      ...rows.map((cells) => new TableRow({ children: cells })),
    ],
  })
}

function spacer(pt = 100) {
  return new Paragraph({ children: [], spacing: { after: pt } })
}

function divider() {
  return new Paragraph({
    children: [],
    spacing: { before: 40, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: 'E2E8F0' } },
  })
}

// 88% blend toward white — same formula as PDF section header tint
function tintHex(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const tr = Math.round(r + (255 - r) * 0.88)
  const tg = Math.round(g + (255 - g) * 0.88)
  const tb = Math.round(b + (255 - b) * 0.88)
  return [tr, tg, tb].map((v) => v.toString(16).padStart(2, '0')).join('')
}

// Section heading: tinted accent background + thick accent left bar — matches PDF section headers
function sectionHeading(text, accentHex = '#E8210A') {
  const color = accentHex.replace('#', '')
  const tinted = tintHex(accentHex)
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 21, color: '0F172A' })],
    spacing: { before: 200, after: 100 },
    shading: { type: ShadingType.CLEAR, fill: tinted },
    indent: { left: 220 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 20, color },
    },
  })
}

async function dataUrlToUint8(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  if (!base64) return null
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function imageSize(dataUrl) {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => res({ w: 720, h: 360 })
    img.src = dataUrl
  })
}

function makeDocConfig(children) {
  return new Document({
    styles: {
      default: { document: { run: { font: 'Calibri', size: 20 } } },
    },
    numbering: {
      config: [{
        reference: 'default-bullet',
        levels: [{
          level: 0,
          format: 'bullet',
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_WIDTH_TWIPS, height: PAGE_HEIGHT_TWIPS },
          margin: { top: MARGIN_TWIPS, right: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS },
        },
      },
      children,
    }],
  })
}

// Parse markdown-like text content into Word paragraphs
function textToParas(content, accentHex = '#E8210A') {
  const accentClean = accentHex.replace('#', '')
  const paras = []
  for (const line of (content || '').split('\n')) {
    if (line.startsWith('# ')) {
      paras.push(new Paragraph({
        children: [new TextRun({ text: line.slice(2), bold: true, size: 28, color: '0F172A' })],
        spacing: { before: 180, after: 80 },
      }))
    } else if (line.startsWith('## ')) {
      paras.push(new Paragraph({
        children: [new TextRun({ text: line.slice(3), bold: true, size: 22, color: accentClean })],
        spacing: { before: 120, after: 60 },
      }))
    } else if (line.startsWith('- [ ] ') || /^- \[[xX]\] /.test(line)) {
      const checked = line[3] !== ' '
      paras.push(new Paragraph({
        children: [new TextRun({ text: (checked ? '☑ ' : '☐ ') + line.slice(6), size: 19, color: checked ? '94A3B8' : '374151', strike: checked })],
        spacing: { after: 60 },
        indent: { left: 360 },
      }))
    } else if (line.startsWith('- ')) {
      paras.push(new Paragraph({
        children: [new TextRun({ text: line.slice(2), size: 19, color: '374151' })],
        numbering: { reference: 'default-bullet', level: 0 },
        spacing: { after: 60 },
      }))
    } else if (line === '') {
      paras.push(spacer(60))
    } else {
      paras.push(new Paragraph({
        children: [new TextRun({ text: line, size: 19, color: '374151' })],
        spacing: { after: 60 },
      }))
    }
  }
  return paras
}

const STATUS_TOPIC = {
  new:        { fill: 'F1F5F9', color: '64748B' },
  open:       { fill: 'EFF6FF', color: '2563EB' },
  inProgress: { fill: 'FFFBEB', color: 'D97706' },
  complete:   { fill: 'F0FDF4', color: '16A34A' },
}
const STATUS_ACTION = {
  todo:       { fill: 'F1F5F9', color: '64748B' },
  inProgress: { fill: 'FFFBEB', color: 'D97706' },
  done:       { fill: 'F0FDF4', color: '16A34A' },
}
const STATUS_SEVERITY = {
  low:      { fill: 'F0FDF4', color: '16A34A' },
  medium:   { fill: 'FFFBEB', color: 'D97706' },
  high:     { fill: 'FFF7ED', color: 'EA580C' },
  critical: { fill: 'FFF1F2', color: 'DC2626' },
}
const STATUS_RISK = {
  open:       { fill: 'EFF6FF', color: '2563EB' },
  monitoring: { fill: 'FFFBEB', color: 'D97706' },
  mitigated:  { fill: 'F0FDF4', color: '16A34A' },
  closed:     { fill: 'F1F5F9', color: '64748B' },
}

export async function buildWordDoc(note, template, chartImages, t) {
  const accent = template?.bannerColor || '#E8210A'
  const accentClean = accent.replace('#', '')
  const tFn = t || ((k) => k)
  const children = []
  const d = note.displayOptions || {}
  const showParticipants = d.showParticipants !== false
  const showRoles = d.showRoles !== false
  const showFirms = d.showFirms !== false
  const showEventType = d.showEventType !== false

  // ── Banner ──────────────────────────────────────────────────────────────────
  const bannerChildren = []
  if (template?.logo?.show && template?.logo?.data) {
    try {
      const bytes = await dataUrlToUint8(template.logo.data)
      const { w, h } = await imageSize(template.logo.data)
      const logoH = 40
      const logoW = Math.round(logoH * (w / (h || 1)))
      if (bytes) bannerChildren.push(new ImageRun({ data: bytes, transformation: { width: logoW, height: logoH } }))
    } catch {}
  }
  if (bannerChildren.length === 0) {
    bannerChildren.push(new TextRun({ text: tFn('meetingNotes') || 'Meeting Notes', bold: true, size: 28, color: 'FFFFFF' }))
  }
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: accentClean, color: 'FFFFFF' },
        borders: { top: noBorder(), left: noBorder(), right: noBorder(), bottom: noBorder() },
        children: [new Paragraph({
          children: bannerChildren,
          spacing: { before: 200, after: 200 },
          indent: { left: 360 },
        })],
      })],
    })],
  }))

  // ── Title area — light gray background matching PDF header strip ─────────────
  children.push(new Paragraph({
    children: [new TextRun({ text: note.title || 'Untitled Meeting', bold: true, size: 40, color: '0F172A' })],
    spacing: { before: 140, after: 80 },
    shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
    indent: { left: 180 },
  }))

  const subtitle = [note.customer, showEventType ? note.eventType : null].filter(Boolean).join(' · ')
  if (subtitle) {
    children.push(new Paragraph({
      children: [new TextRun({ text: subtitle, size: 22, color: '64748B' })],
      spacing: { after: 60 },
      shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
      indent: { left: 180 },
    }))
  }
  if (note.team) {
    children.push(new Paragraph({
      children: [new TextRun({ text: note.team, size: 19, color: '94A3B8' })],
      spacing: { after: 60 },
      shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
      indent: { left: 180 },
    }))
  }
  if (note.date) {
    children.push(new Paragraph({
      children: [new TextRun({ text: fmtDate(note.date), size: 20, color: '94A3B8' })],
      spacing: { after: 100 },
      shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
      indent: { left: 180 },
    }))
  }
  children.push(divider())

  // ── Participants ─────────────────────────────────────────────────────────────
  const activeP = (note.participants || []).filter((p) => p.enabled !== false && p.name)
  if (showParticipants && activeP.length > 0) {
    const pHeaders = ['Name', ...(showFirms ? ['Firm'] : []), ...(showRoles ? ['Role'] : [])]
    const pRows = activeP.map((p) => [dataCell(p.name, true), ...(showFirms ? [dataCell(p.firm || '')] : []), ...(showRoles ? [dataCell(p.role || '')] : [])])
    children.push(new Paragraph({
      children: [new TextRun({ text: tFn('participants')?.toUpperCase() || 'PARTICIPANTS', bold: true, size: 16, color: '94A3B8' })],
      spacing: { before: 100, after: 80 },
    }))
    children.push(makeTable(pHeaders, pRows))
    children.push(divider())
    children.push(spacer(60))
  }

  // ── Sections ─────────────────────────────────────────────────────────────────
  const sections = note.sections || []
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]

    if (s.type === 'text' || s.type === 'notes') {
      const content = s.content || ''
      if (!content.trim() && !s.label) continue
      if (s.label) {
        children.push(sectionHeading(s.label, accent))
      } else if (i > 0) {
        children.push(divider())
      }
      children.push(...textToParas(content, accent))
      continue
    }

    if (s.label) children.push(sectionHeading(s.label, accent))

    if (s.type === 'topics') {
      const items = (s.items || []).filter((item) => item.status !== 'complete')
      if (items.length === 0) continue
      const stLabel = (st) => st === 'inProgress' ? 'In Progress' : (st ? st.charAt(0).toUpperCase() + st.slice(1) : 'New')
      children.push(makeTable(
        [tFn('topic') || 'Topic', tFn('description') || 'Description', tFn('status') || 'Status'],
        items.map((item) => {
          const sc = STATUS_TOPIC[item.status] || STATUS_TOPIC.new
          return [dataCell(item.topic, true), dataCell(item.description), badgeCell(stLabel(item.status), sc.fill, sc.color)]
        })
      ))
      children.push(spacer(160))
    }

    if (s.type === 'actionItems') {
      const items = (s.items || []).filter((item) => item.task)
      if (items.length === 0) continue
      const stLabel = (st) => st === 'inProgress' ? 'In Progress' : st === 'done' ? 'Done' : 'To do'
      children.push(makeTable(
        ['Task', 'Assignee', 'Due Date', 'Status'],
        items.map((item) => {
          const sc = STATUS_ACTION[item.status] || STATUS_ACTION.todo
          return [dataCell(item.task, true), dataCell(item.assignee), dataCell(item.dueDate ? fmtDate(item.dueDate) : ''), badgeCell(stLabel(item.status), sc.fill, sc.color)]
        })
      ))
      children.push(spacer(160))
    }

    if (s.type === 'decisions') {
      const items = (s.items || []).filter((item) => item.decision)
      if (items.length === 0) continue
      children.push(makeTable(
        ['Decision', 'Rationale', 'Owner', 'Date'],
        items.map((item) => [
          dataCell(item.decision, true),
          dataCell(item.rationale),
          dataCell(item.owner),
          dataCell(item.date ? fmtDate(item.date) : ''),
        ])
      ))
      children.push(spacer(160))
    }

    if (s.type === 'risks') {
      const items = (s.items || []).filter((item) => item.risk)
      if (items.length === 0) continue
      const capFirst = (v) => v ? v.charAt(0).toUpperCase() + v.slice(1) : ''
      children.push(makeTable(
        ['Risk / Blocker', 'Severity', 'Owner', 'Mitigation', 'Status'],
        items.map((item) => {
          const sevC = STATUS_SEVERITY[item.severity] || STATUS_SEVERITY.medium
          const stC = STATUS_RISK[item.status] || STATUS_RISK.open
          return [
            dataCell(item.risk, true),
            badgeCell(capFirst(item.severity || 'medium'), sevC.fill, sevC.color),
            dataCell(item.owner || ''),
            dataCell(item.mitigation || ''),
            badgeCell(capFirst(item.status || 'open'), stC.fill, stC.color),
          ]
        })
      ))
      children.push(spacer(160))
    }

    if (s.type === 'resources') {
      const items = (s.items || []).filter((item) => item.label || item.url)
      if (items.length === 0) continue
      for (const item of items) {
        const displayLabel = item.label || item.url || ''
        children.push(new Paragraph({
          children: [new TextRun({ text: `→  ${displayLabel}`, bold: true, size: 19, color: '0F172A' })],
          spacing: { before: 80, after: 20 },
        }))
        if (item.url && item.label) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `    ${item.url}`, size: 17, color: '2563EB' })],
            spacing: { after: 20 },
          }))
        }
        if (item.note) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `    ${item.note}`, size: 17, color: '64748B' })],
            spacing: { after: 20 },
          }))
        }
      }
      children.push(spacer(100))
    }

    if (['graph', 'gantt', 'pie', 'line'].includes(s.type)) {
      const imgData = chartImages?.[s.id]
      if (imgData) {
        const bytes = await dataUrlToUint8(imgData)
        if (bytes) {
          const { w, h } = await imageSize(imgData)
          const imgW = 595
          const imgH = Math.round((h / (w || 1)) * imgW)
          children.push(new Paragraph({
            children: [new ImageRun({ data: bytes, transformation: { width: imgW, height: imgH } })],
            spacing: { after: 200 },
          }))
        }
      }
    }
  }

  return Packer.toBlob(makeDocConfig(children))
}

// ── Bulk export: merge multiple notes into one Word document ──────────────────
export async function buildBulkWordDoc(notes) {
  const children = []

  for (let ni = 0; ni < notes.length; ni++) {
    const note = notes[ni]
    const accent = '#E8210A'

    if (ni > 0) {
      children.push(new Paragraph({ children: [], pageBreakBefore: true, spacing: { before: 0, after: 0 } }))
    }

    // Per-note title block
    children.push(new Paragraph({
      children: [new TextRun({ text: note.title || 'Untitled Meeting', bold: true, size: 40, color: '0F172A' })],
      spacing: { before: 120, after: 80 },
      shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
      indent: { left: 180 },
    }))

    const subtitle = [note.customer, note.eventType].filter(Boolean).join(' · ')
    if (subtitle) {
      children.push(new Paragraph({
        children: [new TextRun({ text: subtitle, size: 22, color: '64748B' })],
        spacing: { after: 60 },
        shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
        indent: { left: 180 },
      }))
    }
    if (note.team) {
      children.push(new Paragraph({
        children: [new TextRun({ text: note.team, size: 19, color: '94A3B8' })],
        spacing: { after: 60 },
        shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
        indent: { left: 180 },
      }))
    }
    if (note.date) {
      children.push(new Paragraph({
        children: [new TextRun({ text: fmtDate(note.date), size: 20, color: '94A3B8' })],
        spacing: { after: 80 },
        shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
        indent: { left: 180 },
      }))
    }
    children.push(divider())

    // Participants
    const activeP = (note.participants || []).filter((p) => p.enabled !== false && p.name)
    if (activeP.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: 'PARTICIPANTS', bold: true, size: 16, color: '94A3B8' })],
        spacing: { before: 80, after: 80 },
      }))
      children.push(makeTable(
        ['Name', 'Firm', 'Role'],
        activeP.map((p) => [dataCell(p.name, true), dataCell(p.firm || ''), dataCell(p.role || '')])
      ))
      children.push(divider())
      children.push(spacer(60))
    }

    // Sections (skip chart types — no canvas available in bulk)
    for (let i = 0; i < (note.sections || []).length; i++) {
      const s = note.sections[i]
      if (['graph', 'gantt', 'pie', 'line'].includes(s.type)) continue

      if (s.type === 'text' || s.type === 'notes') {
        const content = s.content || ''
        if (!content.trim() && !s.label) continue
        if (s.label) {
          children.push(sectionHeading(s.label, accent))
        } else if (i > 0) {
          children.push(divider())
        }
        children.push(...textToParas(content, accent))
        continue
      }

      if (s.label) children.push(sectionHeading(s.label, accent))

      if (s.type === 'topics') {
        const items = (s.items || []).filter((item) => item.status !== 'complete')
        if (items.length === 0) continue
        const stL = (st) => st === 'inProgress' ? 'In Progress' : (st ? st.charAt(0).toUpperCase() + st.slice(1) : 'New')
        children.push(makeTable(
          ['Topic', 'Description', 'Status'],
          items.map((item) => {
            const sc = STATUS_TOPIC[item.status] || STATUS_TOPIC.new
            return [dataCell(item.topic, true), dataCell(item.description), badgeCell(stL(item.status), sc.fill, sc.color)]
          })
        ))
        children.push(spacer(160))
      }

      if (s.type === 'actionItems') {
        const items = (s.items || []).filter((item) => item.task)
        if (items.length === 0) continue
        const stL = (st) => st === 'inProgress' ? 'In Progress' : st === 'done' ? 'Done' : 'To do'
        children.push(makeTable(
          ['Task', 'Assignee', 'Due Date', 'Status'],
          items.map((item) => {
            const sc = STATUS_ACTION[item.status] || STATUS_ACTION.todo
            return [dataCell(item.task, true), dataCell(item.assignee), dataCell(item.dueDate ? fmtDate(item.dueDate) : ''), badgeCell(stL(item.status), sc.fill, sc.color)]
          })
        ))
        children.push(spacer(160))
      }

      if (s.type === 'decisions') {
        const items = (s.items || []).filter((item) => item.decision)
        if (items.length === 0) continue
        children.push(makeTable(
          ['Decision', 'Rationale', 'Owner', 'Date'],
          items.map((item) => [
            dataCell(item.decision, true),
            dataCell(item.rationale),
            dataCell(item.owner),
            dataCell(item.date ? fmtDate(item.date) : ''),
          ])
        ))
        children.push(spacer(160))
      }

      if (s.type === 'risks') {
        const items = (s.items || []).filter((item) => item.risk)
        if (items.length === 0) continue
        const capFirst = (v) => v ? v.charAt(0).toUpperCase() + v.slice(1) : ''
        children.push(makeTable(
          ['Risk / Blocker', 'Severity', 'Owner', 'Mitigation', 'Status'],
          items.map((item) => {
            const sevC = STATUS_SEVERITY[item.severity] || STATUS_SEVERITY.medium
            const stC = STATUS_RISK[item.status] || STATUS_RISK.open
            return [
              dataCell(item.risk, true),
              badgeCell(capFirst(item.severity || 'medium'), sevC.fill, sevC.color),
              dataCell(item.owner || ''),
              dataCell(item.mitigation || ''),
              badgeCell(capFirst(item.status || 'open'), stC.fill, stC.color),
            ]
          })
        ))
        children.push(spacer(160))
      }

      if (s.type === 'resources') {
        const items = (s.items || []).filter((item) => item.label || item.url)
        if (items.length === 0) continue
        for (const item of items) {
          const displayLabel = item.label || item.url || ''
          children.push(new Paragraph({
            children: [new TextRun({ text: `→  ${displayLabel}`, bold: true, size: 19, color: '0F172A' })],
            spacing: { before: 80, after: 20 },
          }))
          if (item.url && item.label) {
            children.push(new Paragraph({
              children: [new TextRun({ text: `    ${item.url}`, size: 17, color: '2563EB' })],
              spacing: { after: 20 },
            }))
          }
          if (item.note) {
            children.push(new Paragraph({
              children: [new TextRun({ text: `    ${item.note}`, size: 17, color: '64748B' })],
              spacing: { after: 20 },
            }))
          }
        }
        children.push(spacer(100))
      }
    }
  }

  return Packer.toBlob(makeDocConfig(children))
}
