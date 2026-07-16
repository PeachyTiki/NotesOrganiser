// Shared task-list shaping logic used by the Tasks page and the floating
// task widget window, so both always agree on what a "task" looks like.
export function buildAllTasks(meetingNotes, standaloneTasks, internalEnabled) {
  const result = []
  for (const note of meetingNotes || []) {
    if (note.isDraft) continue
    const extract = (sections, isInternal) => {
      for (const section of sections || []) {
        if (section.type !== 'tasks') continue
        for (const item of section.items || []) {
          if (!item.text) continue
          result.push({
            ...item,
            noteId: note.id,
            sectionId: section.id,
            isInternal,
            isStandalone: false,
            customer: note.customer || '',
            recurringMeetingId: note.recurringMeetingId || '',
            noteDate: note.date || '',
            noteTitle: note.title || note.customer || 'Untitled',
          })
        }
      }
    }
    extract(note.sections, false)
    if (internalEnabled) extract(note.internalSections, true)
  }

  const standalone = (standaloneTasks || []).map((t) => ({
    ...t,
    isStandalone: true,
    noteId: null,
    sectionId: null,
    isInternal: internalEnabled && !!t.isInternal,
    customer: t.customer || '',
    recurringMeetingId: '',
    noteDate: '',
    noteTitle: '',
  }))

  return [...result, ...standalone]
}

// Monday–Friday range (ISO yyyy-mm-dd) for the week containing `today`.
export function currentWorkWeekRange(today = new Date()) {
  const d = new Date(today)
  const day = d.getDay() // 0 = Sun .. 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  const iso = (dt) => dt.toISOString().slice(0, 10)
  return { start: iso(monday), end: iso(friday) }
}
