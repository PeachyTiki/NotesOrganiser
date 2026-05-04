// Cross-platform safe filename/folder segment
export function safeName(str, maxLen = 50) {
  if (!str) return 'Unnamed'
  const cleaned = str
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen)
  return cleaned || 'Unnamed'
}

// Generate the PDF filename for a note
export function noteFilename(note, isInternal) {
  const date = note.date || 'no-date'
  const customer = safeName(note.customer || 'Unknown', 30)
  const title = safeName(note.title || 'Note', 35)
  const intern = isInternal ? '_intern' : ''
  return `${date}_${customer}_${title}${intern}.pdf`
}

// Returns the path parts array (NOT including filename) for main.cjs to join
export function notePathParts(note, syncConfig, recurringMeetings) {
  const customerPart = safeName(note.customer || 'Unknown', 60)
  let seriesPart
  if (note.recurringMeetingId) {
    const rm = (recurringMeetings || []).find((m) => m.id === note.recurringMeetingId)
    seriesPart = safeName(rm?.name || 'Unknown_Series', 60)
  } else {
    seriesPart = 'Misc_Meetings'
  }
  if (syncConfig.level === 'A') return [syncConfig.destPath, customerPart, seriesPart]
  if (syncConfig.level === 'C') return [syncConfig.destPath, seriesPart]
  return [syncConfig.destPath] // M — flat, no subfolders
}

// Does this note fall within a sync config's scope?
export function noteMatchesSync(note, syncConfig) {
  if (!syncConfig?.destPath) return false
  if (syncConfig.level === 'A') return true
  if (syncConfig.level === 'C') {
    const noteCust = (note.customer || '').trim().toLowerCase()
    const cfgCust = (syncConfig.scopeId || '').trim().toLowerCase()
    return noteCust !== '' && noteCust === cfgCust
  }
  if (syncConfig.level === 'M') {
    return !!note.recurringMeetingId && note.recurringMeetingId === syncConfig.scopeId
  }
  return false
}

// localStorage key for tracking last written absolute path per note+sync+mode
export function syncFileKey(noteId, syncId, isInternal) {
  return `${noteId}|${syncId}|${isInternal ? 'internal' : 'standard'}`
}

const LEVEL_ORDER = { A: 0, C: 1, M: 2 }
export function sortSyncConfigs(configs) {
  return [...(configs || [])].sort(
    (a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9),
  )
}
