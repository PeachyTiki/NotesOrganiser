import { LANGUAGES } from './i18n'

function resolveLanguageName(code) {
  if (!code) return null
  const found = LANGUAGES.find((l) => l.code === code)
  return found ? found.label : null
}

// ─── Tone helper ─────────────────────────────────────────────────────────────

function buildToneString(toneSettings) {
  if (!toneSettings) return 'Professional and concise.'

  const { formality, conciseness, customInstructions } = toneSettings

  const formalityMap = {
    casual: 'casual and friendly',
    professional: 'professional',
    formal: 'formal and precise',
  }

  const concisenessMap = {
    brief: 'Keep it brief with bullet points',
    balanced: 'balanced length',
    detailed: 'detailed and comprehensive',
  }

  const parts = []

  const formalityStr = formalityMap[formality]
  const concisenessStr = concisenessMap[conciseness]

  if (formalityStr) parts.push(formalityStr)
  if (concisenessStr) parts.push(concisenessStr)
  if (customInstructions?.trim()) parts.push(customInstructions.trim())

  if (parts.length === 0) return 'Professional and concise.'

  return parts.join('. ') + (parts[parts.length - 1].endsWith('.') ? '' : '.')
}

// ─── Build prompt ─────────────────────────────────────────────────────────────

export function buildAIPrompt(note, allMeetingNotes, mode, toneSettings) {
  const langName = resolveLanguageName(note.language)
  return {
    _version: '1',
    _type: 'meeting_notes_prompt',
    output_mode: mode,
    instructions: {
      task: 'Using the transcript or notes you receive, fill in the CURRENT SESSION meeting notes only. Previous sessions are provided as context — do not modify them.',
      output_language: langName
        ? `Write ALL output content in ${langName}. This applies regardless of what language the transcript or raw notes are in.`
        : undefined,
      output_format:
        mode === 'json'
          ? 'Return only the current_session.sections array as valid JSON, with content filled in. Keep all section IDs unchanged. Only add text to sections with type "text". For topics/actionItems/decisions you may add new items but keep existing ones.'
          : 'Return the meeting notes as clean formatted text using markdown (## for headings, - for bullets, - [ ] for unchecked items, - [x] for checked items).',
      tone: buildToneString(toneSettings),
    },
    meeting_context: {
      title: note.title || 'Untitled',
      customer: note.customer || '',
      event_type: note.eventType || '',
      team: note.team || '',
      date: note.date || '',
      language: langName || note.language || 'en',
      participants: (note.participants || [])
        .filter((p) => p.enabled !== false && p.name)
        .map((p) => ({ name: p.name, role: p.role || '', firm: p.firm || '' })),
    },
    previous_sessions: allMeetingNotes
      .filter(
        (n) =>
          n.recurringMeetingId &&
          n.recurringMeetingId === note.recurringMeetingId &&
          n.id !== note.id,
      )
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(-5)
      .map((n) => ({
        date: n.date,
        title: n.title,
        sections: (n.sections || []).map((s) => ({
          type: s.type,
          label: s.label || '',
          ...(s.type === 'text' ? { content: s.content } : {}),
          ...(s.items ? { items: s.items } : {}),
        })),
      })),
    current_session: {
      date: note.date || '',
      sections: (note.sections || []).map((s) => ({
        ...s,
        ...(s.type === 'text' ? { content: s.content || '' } : {}),
      })),
    },
  }
}

// ─── Import JSON response ─────────────────────────────────────────────────────

export function importAIJsonResponse(jsonStr, currentSections) {
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('Invalid JSON: could not parse the LLM response. Make sure you copied the full JSON output.')
  }

  let aiSections
  if (Array.isArray(parsed?.sections)) {
    aiSections = parsed.sections
  } else if (Array.isArray(parsed?.current_session?.sections)) {
    aiSections = parsed.current_session.sections
  } else if (Array.isArray(parsed)) {
    aiSections = parsed
  } else {
    throw new Error('No sections found in the JSON response. Expected a sections array, current_session.sections, or a top-level array.')
  }

  return currentSections.map((section) => {
    const match = aiSections.find((s) => s.id === section.id)
    if (!match) return section

    if (section.type === 'text') {
      return { ...section, content: match.content ?? section.content }
    }

    if (
      section.type === 'topics' ||
      section.type === 'actionItems' ||
      section.type === 'decisions'
    ) {
      const existingIds = new Set((section.items || []).map((i) => i.id))
      const newItems = (match.items || []).filter((i) => !existingIds.has(i.id))
      return { ...section, items: [...(section.items || []), ...newItems] }
    }

    return section
  })
}

// ─── Import text response ─────────────────────────────────────────────────────

export function importAITextResponse(text, currentSections) {
  const idx = currentSections.findIndex((s) => s.type === 'text')
  if (idx === -1) return currentSections

  return currentSections.map((s, i) => (i === idx ? { ...s, content: text } : s))
}

// ─── Section-scoped prompt (for the Notes section type) ───────────────────────

export function buildSectionAIPrompt(section, note, allMeetingNotes, toneSettings) {
  const langName = resolveLanguageName(note.language)
  const hasTranscript = !!(section.content?.trim())
  return {
    _version: '1',
    _type: 'notes_section_prompt',
    instructions: {
      task: hasTranscript
        ? `The "${section.label || 'Notes'}" section contains raw notes or a transcript written during the meeting (see current_section.transcript). Clean it up into well-structured, formatted notes.`
        : `The "${section.label || 'Notes'}" section has no transcript yet. Ask the user to share their meeting notes or transcript in this chat — do not generate placeholder content without it.`,
      output_language: langName
        ? `Write ALL output content in ${langName}. This applies regardless of what language the transcript or raw notes are in.`
        : undefined,
      output_format:
        'Return a JSON object with a single "content" field containing the formatted notes as markdown text. Example: {"content": "## Summary\\n- Point one\\n- Point two"}. Plain text is also accepted by the app.',
      tone: buildToneString(toneSettings),
    },
    meeting_context: {
      title: note.title || 'Untitled',
      customer: note.customer || '',
      event_type: note.eventType || '',
      team: note.team || '',
      date: note.date || '',
      language: langName || note.language || 'en',
      participants: (note.participants || [])
        .filter((p) => p.enabled !== false && p.name)
        .map((p) => ({ name: p.name, role: p.role || '', firm: p.firm || '' })),
    },
    previous_sessions: allMeetingNotes
      .filter(
        (n) =>
          n.recurringMeetingId &&
          n.recurringMeetingId === note.recurringMeetingId &&
          n.id !== note.id,
      )
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(-5)
      .map((n) => ({
        date: n.date,
        title: n.title,
        sections: (n.sections || [])
          .filter((s) => s.type === 'text' || s.type === 'notes')
          .map((s) => ({ label: s.label || '', content: s.content || '' })),
      })),
    current_section: {
      id: section.id,
      label: section.label || 'Notes',
      transcript: section.content || '',
    },
  }
}

// ─── Context / summary prompt (library export at any scope level) ─────────────

function serializeSections(sections) {
  const result = {}

  const texts = (sections || []).filter((s) => s.type === 'text' || s.type === 'notes')
  if (texts.length) result.notes = texts.map((s) => ({ label: s.label || '', content: s.content || '' }))

  const topics = (sections || []).filter((s) => s.type === 'topics')
  if (topics.length) result.topics = topics.flatMap((s) =>
    (s.items || []).map((i) => ({ label: s.label || 'Topics', topic: i.topic || '', description: i.description || '', status: i.status || 'open' }))
  )

  const actions = (sections || []).filter((s) => s.type === 'actionItems')
  if (actions.length) result.action_items = actions.flatMap((s) =>
    (s.items || []).map((i) => ({ task: i.task || '', assignee: i.assignee || '', due: i.due || '', status: i.status || 'open' }))
  )

  const decisions = (sections || []).filter((s) => s.type === 'decisions')
  if (decisions.length) result.decisions = decisions.flatMap((s) =>
    (s.items || []).map((i) => ({ decision: i.decision || '', owner: i.owner || '', note: i.note || '' }))
  )

  const gantt = (sections || []).filter((s) => s.type === 'gantt')
  if (gantt.length) result.gantt = gantt.flatMap((s) =>
    (s.data || []).map((i) => ({ label: s.label || 'Timeline', task: i.task || '', start: i.start || '', end: i.end || '', progress: i.progress ?? null, category: i.category || '' }))
  )

  const charts = (sections || []).filter((s) => s.type === 'graph' || s.type === 'pie' || s.type === 'line')
  if (charts.length) result.charts = charts.map((s) => ({
    type: s.type, label: s.label || '',
    data: s.data || [], xLabels: s.xLabels || undefined, series: s.series || undefined,
  }))

  const risks = (sections || []).filter((s) => s.type === 'risks')
  if (risks.length) result.risks = risks.flatMap((s) =>
    (s.items || []).map((i) => ({ risk: i.risk || '', severity: i.severity || 'medium', owner: i.owner || '', mitigation: i.mitigation || '', status: i.status || 'open' }))
  )

  const resources = (sections || []).filter((s) => s.type === 'resources')
  if (resources.length) result.resources = resources.flatMap((s) =>
    (s.items || []).map((i) => ({ label: i.label || '', url: i.url || '', note: i.note || '' }))
  )

  return result
}

export function buildContextAIPrompt(notes, scopeLabel, scope) {
  const sorted = [...notes].sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  return {
    _version: '1',
    _type: 'context_summary_prompt',
    scope,
    scope_label: scopeLabel,
    instructions: {
      task: [
        `You have been given the complete meeting history for: "${scopeLabel}".`,
        'Provide a comprehensive status report covering:',
        '1. OVERALL STANDING — brief executive summary of where things are today',
        '2. OPEN TOPICS — list all topics that are still open or in-progress across all meetings',
        '3. PENDING ACTION ITEMS — list every action item that has not been marked done, grouped by assignee if possible',
        '4. RECENTLY COMPLETED — highlights of what was finished or closed recently',
        '5. PROJECT TIMELINE (if Gantt data is present) — assess progress against the plan, flag any late or at-risk tasks',
        '6. KEY DECISIONS — summarise important decisions recorded across these meetings',
        '7. NEXT STEPS — recommended priorities based on the open work',
      ].join('\n'),
      additional_use: 'After generating the summary the user may ask follow-up questions about any of these meetings. You have full context to answer questions such as "When was X decided?", "What is the status of project Y?", "Who is responsible for Z?".',
      format: 'Use clear markdown with ## headings for each section. Use bullet points for lists.',
    },
    meetings: sorted.map((n) => ({
      date: n.date || '',
      title: n.title || 'Untitled',
      customer: n.customer || '',
      event_type: n.eventType || '',
      team: n.team || '',
      participants: (n.participants || [])
        .filter((p) => p.enabled !== false && p.name)
        .map((p) => ({ name: p.name, role: p.role || '', firm: p.firm || '' })),
      content: serializeSections(n.sections),
    })),
  }
}

// Parse a section-scoped JSON response — returns just the content string
export function importSectionJsonResponse(jsonStr) {
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('Invalid JSON — could not parse the LLM response.')
  }
  if (typeof parsed === 'string') return parsed
  if (typeof parsed?.content === 'string') return parsed.content
  // Fallback: accept the whole object stringified
  throw new Error('Expected {"content": "..."} in the JSON response.')
}
