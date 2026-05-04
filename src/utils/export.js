import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { buildPDF } from './exportPDF'
import { buildWordDoc, buildBulkWordDoc } from './exportWord'

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function captureElement(el, scale = 2) {
  return html2canvas(el, { scale, useCORS: true, backgroundColor: '#ffffff', logging: false })
}

function sanitizeFilename(str) {
  return (str || 'unnamed').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 60)
}

function dataUrlToBlob(dataUrl) {
  const arr = dataUrl.split(',')
  if (arr.length < 2) return null
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
  try {
    const bstr = atob(arr[1])
    const u8arr = new Uint8Array(bstr.length)
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i)
    return new Blob([u8arr], { type: mime })
  } catch { return null }
}

// ─── Chart capture ────────────────────────────────────────────────────────────
// Scoped to the off-screen canvas container to avoid capturing A4Preview's scaled instance

export async function captureChartImages(sections) {
  const chartTypes = new Set(['graph', 'gantt', 'pie', 'line'])
  const result = {}
  const root = document.getElementById('offscreen-export-canvas') || document.body
  for (const s of (sections || [])) {
    if (!chartTypes.has(s.type)) continue
    const el = root.querySelector(`#chart-section-${s.id}`)
    if (!el) continue
    try {
      const canvas = await captureElement(el, 3)
      result[s.id] = canvas.toDataURL('image/png')
    } catch { /* skip broken charts */ }
  }
  return result
}

// ─── Off-screen chart capture for bulk export ─────────────────────────────────
// Temporarily mounts NoteExportCanvas into a hidden div, waits for render,
// captures each chart section, then cleans up.

const CHART_TYPES = new Set(['graph', 'gantt', 'pie', 'line'])

async function captureNoteCharts(note, template) {
  const hasCharts = (note.sections || []).some((s) => CHART_TYPES.has(s.type))
  if (!hasCharts) return {}

  const { createElement } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { default: NoteExportCanvas } = await import('../components/meetings/NoteExportCanvas')

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;pointer-events:none;z-index:-1;'
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(createElement(NoteExportCanvas, { note, template: template || null }))

  await new Promise((r) => setTimeout(r, 450))

  const result = {}
  for (const s of (note.sections || [])) {
    if (!CHART_TYPES.has(s.type)) continue
    const el = container.querySelector(`#chart-section-${s.id}`)
    if (!el) continue
    try {
      const canvas = await captureElement(el, 3)
      result[s.id] = canvas.toDataURL('image/png')
    } catch { /* skip */ }
  }

  root.unmount()
  document.body.removeChild(container)
  return result
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

export async function captureThumbPNG(elementId) {
  const el = document.getElementById(elementId)
  if (!el) return null
  try {
    const canvas = await captureElement(el, 1)
    return canvas.toDataURL('image/jpeg', 0.55)
  } catch { return null }
}

// ─── Main export entry points ─────────────────────────────────────────────────

export async function exportNoteAsPDF(note, template, chartImages, t) {
  return buildPDF(note, template, chartImages, t)
}

export async function exportNoteAsWord(note, template, chartImages, t) {
  return buildWordDoc(note, template, chartImages, t)
}

// Single-note export from the library (captures charts on demand)
export async function exportSingleNote(note, template, format, filename) {
  if (format === 'png') {
    if (!note.exportData) {
      alert('No image preview for this note yet.\n\nOpen the note and click Export to generate one first.')
      return false
    }
    downloadDataURL(note.exportData, filename)
    return true
  }
  const chartImages = await captureNoteCharts(note, template)
  if (format === 'pdf') {
    const pdf = await buildPDF(note, template, chartImages, null)
    downloadPDF(pdf, filename)
  } else if (format === 'docx') {
    const blob = await buildWordDoc(note, template, chartImages, null)
    downloadBlob(blob, filename)
  }
  return true
}

// ─── Sync helpers — generate PDF buffer without triggering a download ─────────

// Returns ArrayBuffer of the PDF. Uses the same captureNoteCharts approach as exportSingleNote.
export async function renderNoteToPdfBuffer(note, template, t) {
  const chartImages = await captureNoteCharts(note, template)
  const pdf = await buildPDF(note, template, chartImages, t || null)
  return pdf.output('arraybuffer')
}

// Convert ArrayBuffer → base64 string for IPC transfer
// Chunked to avoid O(n²) string concatenation and spread stack-overflow on large PDFs
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 8192
  const parts = []
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)))
  }
  return btoa(parts.join(''))
}

// ─── Download helpers ─────────────────────────────────────────────────────────

export function downloadPDF(pdf, filename) {
  pdf.save(filename)
}

export function downloadDataURL(dataURL, filename) {
  const a = document.createElement('a')
  a.href = dataURL
  a.download = filename
  a.click()
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function formatDateForFilename(dateStr) {
  const d = dateStr || new Date().toISOString().slice(0, 10)
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

// ─── ZIP export (library bulk export) ────────────────────────────────────────
// exportGroups: [{ customerName, subgroups: [{ label, notes }] }]
// level: 'library' (customer/meeting/files) | 'customer' (meeting/files) | 'meeting' (files only)
// format: 'pdf' | 'docx' | 'png'
// templates: array of all templates (for looking up accent/logo per note)

export async function bulkExportToZip(exportGroups, templates, format, zipFilename, level) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  let added = 0
  let skipped = 0

  for (const group of exportGroups) {
    for (const sg of group.subgroups) {
      // Determine target folder based on hierarchy level
      let folder
      if (level === 'library') {
        folder = zip.folder(sanitizeFilename(group.customerName)).folder(sanitizeFilename(sg.label))
      } else if (level === 'customer') {
        folder = zip.folder(sanitizeFilename(sg.label))
      } else {
        folder = zip  // files directly at ZIP root
      }

      for (const note of sg.notes) {
        const template = (templates || []).find((t) => t.id === note.templateId) || null
        const baseName = `${formatDateForFilename(note.date)}_${sanitizeFilename(note.title || 'note')}`

        try {
          if (format === 'pdf') {
            const chartImages = await captureNoteCharts(note, template)
            const pdf = await buildPDF(note, template, chartImages, null)
            const blob = pdf.output('blob')
            folder.file(baseName + '.pdf', blob)
            added++
          } else if (format === 'docx') {
            const chartImages = await captureNoteCharts(note, template)
            const blob = await buildWordDoc(note, template, chartImages, null)
            folder.file(baseName + '.docx', blob)
            added++
          } else if (format === 'png') {
            if (!note.exportData) { skipped++; continue }
            const blob = dataUrlToBlob(note.exportData)
            if (blob) { folder.file(baseName + '.jpg', blob); added++ }
            else skipped++
          }
        } catch { skipped++ }
      }
    }
  }

  if (added === 0) {
    if (format === 'png') {
      alert('No notes have preview images yet.\n\nOpen each note and click Export to generate a preview first.')
    } else {
      alert('No notes to export.')
    }
    return false
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(zipBlob, zipFilename)

  if (skipped > 0 && format === 'png') {
    alert(`Downloaded ${added} image${added !== 1 ? 's' : ''}.\n${skipped} skipped — open those notes and click Export to generate previews.`)
  }

  return true
}

// ─── Legacy single-level bulk exports (kept for compatibility) ────────────────

export async function bulkExportToWord(notes, filename) {
  if (notes.length === 0) { alert('No notes to export.'); return false }
  const blob = await buildBulkWordDoc(notes)
  downloadBlob(blob, filename)
  return true
}

export async function bulkExportToPDF(notes, filename) {
  const exportable = notes.filter((n) => n.exportData)
  if (exportable.length === 0) {
    alert('No notes in this group have been exported yet.\n\nOpen each note and click Export to generate a downloadable copy first.')
    return false
  }

  const pages = await Promise.all(
    exportable.map((note) =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ note, ar: img.naturalHeight / (img.naturalWidth || 1) })
        img.onerror = () => resolve(null)
        img.src = note.exportData
      })
    )
  )

  const valid = pages.filter(Boolean)
  if (valid.length === 0) { alert('Could not load note images.'); return false }

  const pdfW = 210
  const firstH = pdfW * valid[0].ar
  const pdf = new jsPDF({ unit: 'mm', format: [pdfW, firstH] })
  valid.forEach(({ note, ar }, idx) => {
    const pageH = pdfW * ar
    if (idx > 0) pdf.addPage([pdfW, pageH])
    pdf.addImage(note.exportData, 'JPEG', 0, 0, pdfW, pageH)
  })
  pdf.save(filename)

  const skipped = notes.length - exportable.length
  if (skipped > 0) alert(`Exported ${valid.length} note${valid.length !== 1 ? 's' : ''}.\n${skipped} skipped (not yet exported).`)
  return true
}
