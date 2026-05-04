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
          ? 'CRITICAL: Respond with ONLY a raw JSON object. No code fences (```), no markdown, no explanation text before or after. The response MUST start with { and end with }. Return only the current_session.sections array as valid JSON, with content filled in. Keep all section IDs unchanged. Only add text to sections with type "text". For topics/actionItems/decisions you may add new items but keep existing ones.'
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

export function buildSectionAIPrompt(section, note, allMeetingNotes, toneSettings, contextDepth = 4) {
  const langName = resolveLanguageName(note.language)
  const hasTranscript = !!(section.content?.trim())

  // Take the N most recent prior notes in this series, sorted oldest→newest so the AI reads them in order.
  // Tie-break by updatedAt so manually edited older notes reflect their latest content.
  const previousSessions = contextDepth > 0 && note.recurringMeetingId
    ? allMeetingNotes
        .filter(
          (n) =>
            n.recurringMeetingId === note.recurringMeetingId &&
            n.id !== note.id,
        )
        .sort((a, b) => {
          const d = (a.date || '').localeCompare(b.date || '')
          return d !== 0 ? d : (a.updatedAt || '').localeCompare(b.updatedAt || '')
        })
        .slice(-contextDepth)
        .map((n) => ({
          date: n.date,
          title: n.title || 'Untitled',
          participants: (n.participants || [])
            .filter((p) => p.enabled !== false && p.name)
            .map((p) => ({ name: p.name, role: p.role || '' })),
          content: serializeSections(n.sections),
        }))
    : []

  return {
    _version: '1',
    _type: 'notes_section_prompt',
    instructions: {
      task: hasTranscript
        ? `The "${section.label || 'Notes'}" section contains raw notes or a transcript written during the meeting (see current_section.transcript). Clean it up into well-structured, formatted notes.`
        : `The "${section.label || 'Notes'}" section has no transcript yet. Ask the user to share their meeting notes or transcript in this chat — do not generate placeholder content without it.`,
      context_rule: previousSessions.length > 0
        ? [
            `CRITICAL CONTEXT RULE: The previous_sessions field contains the ${previousSessions.length} most recent prior meeting(s) in this series. They are READ-ONLY BACKGROUND CONTEXT.`,
            `Use them ONLY to understand recurring topics, running acronyms, ongoing decisions, open action items, and relationships between participants.`,
            `DO NOT write notes for previous sessions. DO NOT copy or re-summarise content from previous sessions into your output.`,
            `DO NOT reference previous sessions explicitly (e.g. "as discussed last week…") unless it appears in the current transcript.`,
            `Your output covers ONLY the current session on ${note.date || 'today'}.`,
          ].join(' ')
        : undefined,
      output_language: langName
        ? `Write ALL output content in ${langName}. This applies regardless of what language the transcript or raw notes are in.`
        : undefined,
      output_format: [
        'CRITICAL: Respond with ONLY a raw JSON object — no code fences (```json or ```), no introductory text, no explanation after.',
        'The response MUST start with { and end with }.',
        'Required format: {"content": "your formatted notes here"}',
        'Inside the "content" string, use markdown: ## for headings, - for bullets, - [ ] for open tasks, - [x] for done tasks, **bold** for key terms.',
        'Example: {"content": "## Meeting Summary\\n- Discussed Q3 roadmap\\n- **Decision:** Launch in October\\n\\n## Action Items\\n- [ ] Alice: Write spec by Friday"}',
        'If the transcript is absent or unclear, ask the user in plain text (not JSON) to provide their notes.',
      ].join(' '),
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
    previous_sessions: previousSessions,
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
        `You have been given the COMPLETE meeting history for: "${scopeLabel}".`,
        'Produce a thorough, detailed status report. Be specific — name people, dates, decisions, and exact tasks. Do not summarise vaguely.',
        '',
        'Your report MUST cover ALL of the following sections (omit only if truly no data exists):',
        '',
        '## 1. Executive Summary',
        'Two to four sentences on the current overall state of this engagement/project. What is happening, where are we, what is the mood/momentum?',
        '',
        '## 2. Open Topics & Discussions',
        'List EVERY topic marked open or in-progress across all meetings. For each: topic name, which meeting it was raised in, current status, who owns it.',
        '',
        '## 3. Pending Action Items',
        'List EVERY action item not marked done. Group by assignee. Include: task description, who assigned it, due date if known, which meeting it came from.',
        '',
        '## 4. Completed Work',
        'List topics closed and action items marked done. Include which meeting they were resolved in and any outcome noted.',
        '',
        '## 5. Key Decisions Log',
        'Enumerate all formal decisions recorded. Include: decision text, date/meeting, owner, and any rationale or note.',
        '',
        '## 6. Risks & Blockers',
        'List all risks and blockers recorded (open and resolved). Include severity, owner, mitigation, and current status.',
        '',
        '## 7. Project Timeline',
        'If Gantt chart data is present: list all tasks with their planned start/end dates, actual progress, and flag any tasks that are overdue or at risk.',
        '',
        '## 8. Resources & References',
        'List all links and resources noted across meetings with their labels and any notes.',
        '',
        '## 9. Meeting-by-Meeting Highlights',
        'For each meeting in chronological order: one paragraph covering what was discussed, what was decided, and what was assigned.',
        '',
        '## 10. Recommended Next Steps',
        'Based on all open work, suggest the top 5–7 prioritised actions the team should focus on next, with suggested owners where obvious.',
        '',
        'Be exhaustive. Include verbatim quotes from notes where they add clarity.',
      ].join('\n'),
      additional_use: 'After generating this report the user may ask follow-up questions about any aspect of these meetings. You have full context to answer questions such as "When was X decided?", "What is the status of project Y?", "Who is responsible for Z?", "What did we discuss on [date]?".',
      format: 'Use clear markdown with ## headings. Use bullet points and sub-bullets for lists. Use **bold** for names, decisions, and deadlines.',
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
  // If the AI returned the whole prompt unchanged, pull out transcript as fallback
  if (typeof parsed?.current_section?.transcript === 'string') return parsed.current_section.transcript
  throw new Error('Expected {"content": "your notes here"} in the JSON response. Make sure the AI returned the correct format.')
}
