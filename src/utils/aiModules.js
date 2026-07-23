import { v4 as uuid } from 'uuid'

// Turns AI "module" specs (from a Claude response) into full section objects
// that render exactly like manually-added sections. The shapes here MUST mirror
// newSection() in SectionList.jsx and each section component's item/data shape.
//
// Everything is defensive: unknown types are skipped, missing fields default,
// values are coerced to the strings the section editors expect — a malformed
// AI reply can never crash the import, it just yields fewer/emptier sections.

const str = (v) => (v == null ? '' : String(v))
// Charts store numbers as strings in the editors ('' when blank).
const num = (v) => {
  if (v == null || v === '') return ''
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? String(n) : ''
}
const arr = (x) => (Array.isArray(x) ? x : [])
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback)
const xLabelsToString = (x) => (Array.isArray(x) ? x.map(str).join(', ') : str(x))

function buildOne(spec) {
  if (!spec || typeof spec !== 'object') return null
  const id = uuid()
  const label = str(spec.label)
  switch (spec.type) {
    case 'text':
    case 'notes':
      return { id, type: spec.type, label, content: str(spec.content) }

    case 'topics':
      return { id, type: 'topics', label, items: arr(spec.items).map((i) => ({
        id: uuid(), topic: str(i.topic), description: str(i.description),
        status: oneOf(i.status, ['new', 'open', 'inProgress', 'complete'], 'open'),
      })) }

    case 'decisions':
      return { id, type: 'decisions', label: label || 'Decision Log', items: arr(spec.items).map((i) => ({
        id: uuid(), decision: str(i.decision), rationale: str(i.rationale ?? i.note),
        owner: str(i.owner), date: str(i.date),
      })) }

    case 'risks':
      return { id, type: 'risks', label: label || 'Risks & Blockers', items: arr(spec.items).map((i) => ({
        id: uuid(), risk: str(i.risk), severity: oneOf(i.severity, ['low', 'medium', 'high', 'critical'], 'medium'),
        owner: str(i.owner), mitigation: str(i.mitigation),
        status: oneOf(i.status, ['open', 'monitoring', 'mitigated', 'closed'], 'open'),
      })) }

    case 'resources':
      return { id, type: 'resources', label: label || 'Resources & Links', items: arr(spec.items).map((i) => ({
        id: uuid(), label: str(i.label), url: str(i.url), note: str(i.note),
      })) }

    case 'tasks':
      return { id, type: 'tasks', label, items: arr(spec.items).map((i) => ({
        id: uuid(), text: str(i.text), assignee: str(i.assignee),
        status: oneOf(i.status, ['planned', 'inProgress', 'complete', 'blocked'], 'planned'),
        startDate: str(i.startDate), endDate: str(i.endDate), createdAt: new Date().toISOString(),
      })) }

    case 'graph': // bar chart
      return { id, type: 'graph', label, colorMode: 'individual', colorRules: [], data: arr(spec.data).map((d) => ({
        id: uuid(), label: str(d.label), value: num(d.value), color: '',
      })) }

    case 'pie':
      return { id, type: 'pie', label, data: arr(spec.data).map((d) => ({
        id: uuid(), label: str(d.label), value: num(d.value), color: '',
      })) }

    case 'gantt':
      return { id, type: 'gantt', label, colorMode: 'theme', data: arr(spec.data).map((d) => ({
        id: uuid(), label: str(d.label ?? d.task),
        startDate: str(d.startDate ?? d.start), endDate: str(d.endDate ?? d.end),
        endMode: 'date', workDays: '', onTrack: '', description: str(d.description),
      })) }

    case 'line':
      return { id, type: 'line', label, xLabels: xLabelsToString(spec.xLabels), series: arr(spec.series).map((s) => ({
        id: uuid(), name: str(s.name), color: '', values: arr(s.values).map(num),
      })) }

    default:
      return null
  }
}

// specs → array of section objects (empty array if none valid).
export function sectionsFromModuleSpecs(specs) {
  return arr(specs).map(buildOne).filter(Boolean)
}

// Pulls the module-spec array out of a parsed AI response, tolerating either key.
export function extractModuleSpecs(parsed) {
  if (!parsed || typeof parsed !== 'object') return []
  if (Array.isArray(parsed.modules)) return parsed.modules
  if (Array.isArray(parsed.sections_to_add)) return parsed.sections_to_add
  return []
}
