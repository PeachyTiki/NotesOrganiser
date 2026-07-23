import { LANGUAGES } from './i18n'

// Prompt "modes": 'download' vs the copy-paste family ('clipboard' and
// 'clipboard-open'). The terse "raw JSON only" instructions apply to every
// copy-paste mode — hence the `!== 'download'` checks below.

// Optional module-suggestion protocol. After cleaning the notes, Claude may
// offer to turn well-supported content into structured modules (charts, gantt,
// decisions, …). It asks a numbered plain-text question first; once the user
// picks numbers, it returns the final JSON with a "modules" array. The importer
// (utils/aiModules.js) builds real sections from those specs.
const MODULE_PROTOCOL = [
  'OPTIONAL MODULES: after you have the cleaned notes ready, judge whether the transcript genuinely contains data for any of these structured modules: bar chart (type "graph"), pie chart ("pie"), line chart ("line"), Gantt timeline ("gantt"), decisions log ("decisions"), risks & blockers ("risks"), topics ("topics"), resources & links ("resources"), or a tasks list ("tasks").',
  'Only suggest a module when the real content supports it (numbers for a chart, dated activities for a Gantt, etc.). Never invent data to fill one.',
  'IF you have one or more good suggestions, DO NOT send the JSON yet. FIRST reply in PLAIN TEXT (no JSON, no code fences), in exactly this shape:',
  'Hi — would you like to add any of the following?',
  '1. <Module type> (for <short topic>) — <one-line preview of the content, e.g. "Sales 30%, Marketing 40%, Ops 30%" or "3 tasks across Jan–Mar">',
  '2. <next suggestion>',
  'If a module needs a little more info before it can be built, append to its line: " — before adding, please provide: <what you need>".',
  'Finish with: "Reply with the numbers you want (e.g. 1 3), or say no."',
  'THEN wait. When the user replies with numbers (or "no"), send ONLY the final raw JSON: the usual notes object PLUS a "modules" array holding the chosen modules (omit "modules" or use [] if they said no). Anything not turned into a module stays written up in the notes content as normal.',
  'This module question is the ONLY time you may reply in plain text; every other reply, including the final one, is raw JSON only.',
  'Each "modules" entry uses one of these shapes (include only fields you actually have — the app fills defaults):',
  '{"type":"graph","label":"Revenue by team","data":[{"label":"Sales","value":30},{"label":"Ops","value":70}]}',
  '{"type":"pie","label":"Budget split","data":[{"label":"R&D","value":40}]}',
  '{"type":"line","label":"Signups","xLabels":"Jan,Feb,Mar","series":[{"name":"2025","values":[10,20,35]}]}',
  '{"type":"gantt","label":"Rollout","data":[{"label":"Design","startDate":"2025-01-05","endDate":"2025-02-01","description":""}]}',
  '{"type":"topics","label":"Open topics","items":[{"topic":"Pricing","description":"…","status":"open"}]}',
  '{"type":"decisions","label":"Decisions","items":[{"decision":"Launch in Q3","rationale":"…","owner":"Alice","date":"2025-06-01"}]}',
  '{"type":"risks","label":"Risks","items":[{"risk":"Vendor delay","severity":"high","owner":"Bob","mitigation":"…","status":"open"}]}',
  '{"type":"resources","label":"Links","items":[{"label":"Spec","url":"https://…","note":""}]}',
  '{"type":"tasks","label":"Follow-ups","items":[{"text":"Send deck","assignee":"Alice","status":"planned","startDate":"","endDate":""}]}',
  'Enum values: topics.status = new|open|inProgress|complete; risks.severity = low|medium|high|critical; risks.status = open|monitoring|mitigated|closed; tasks.status = planned|inProgress|complete|blocked. All dates are YYYY-MM-DD.',
  'IF nothing is clearly supported, skip all of this and just return the normal notes JSON.',
].join('\n')

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

// ─── Section-scoped prompt (for the Notes section type) ───────────────────────

export function buildSectionAIPrompt(section, note, allMeetingNotes, toneSettings, contextDepth = 4, promptMode = 'download') {
  const langName = resolveLanguageName(note.language)
  const hasTranscript = !!(section.content?.trim())

  // Take the N most recent prior notes in this series, sorted oldest→newest so the AI reads them in order.
  // Tie-break by updatedAt so manually edited older notes reflect their latest content.
  const previousSessions = contextDepth > 0 && note.recurringMeetingId
    ? allMeetingNotes
        .filter(
          (n) =>
            n.recurringMeetingId === note.recurringMeetingId &&
            n.id !== note.id &&
            !n.isDraft,
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
      context_rule: [
        ...(previousSessions.length > 0 ? [
          `CRITICAL CONTEXT RULE: The previous_sessions field contains the ${previousSessions.length} most recent prior meeting(s) in this series. They are READ-ONLY BACKGROUND CONTEXT.`,
          `Use them ONLY to understand recurring topics, running acronyms, ongoing decisions, open action items, and relationships between participants.`,
          `DO NOT write notes for previous sessions. DO NOT copy or re-summarise content from previous sessions into your output.`,
          `DO NOT reference previous sessions explicitly (e.g. "as discussed last week…") unless it appears in the current transcript.`,
          `Your output covers ONLY the current session on ${note.date || 'today'}.`,
        ] : []),
        `The other_current_sections field (if present) contains the other sections already filled in for this meeting (topics, tasks, decisions, etc.). Use them as additional context to enrich the notes — ensure the written notes are consistent with any topics, tasks, or decisions already recorded.`,
      ].join(' ') || undefined,
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
        ...(promptMode !== 'download' ? ['ZERO additional text. Your entire message must be only the JSON object. Do not greet, do not explain, do not use code fences. Start your response with { and end with }.'] : []),
      ].join(' '),
      optional_modules: MODULE_PROTOCOL,
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
    other_current_sections: (() => {
      const others = (note.sections || []).filter((s) => s.id !== section.id)
      const out = serializeSections(others)
      return Object.keys(out).length > 0 ? out : undefined
    })(),
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

  const actions = (sections || []).filter((s) => s.type === 'tasks')
  if (actions.length) result.tasks = actions.flatMap((s) =>
    (s.items || []).map((i) => ({ text: i.text || '', assignee: i.assignee || '', startDate: i.startDate || '', endDate: i.endDate || '', status: i.status || 'planned' }))
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

// ─── Whole-note AI edit prompt ───────────────────────────────────────────────
// Serialises every section (from serializeSectionsForEdit in utils/aiModules)
// plus a free-text instruction. Claude returns the full edited note as
// {"sections": [...]}, which the app rebuilds via sectionsFromModuleSpecs.
export function buildNoteEditAIPrompt(sectionSpecs, instruction, promptMode = 'clipboard') {
  return {
    _version: '1',
    _type: 'note_edit_prompt',
    instructions: {
      task: 'You are editing an existing meeting note. Apply the requested edits to the sections provided.',
      edit_request: (instruction || '').trim() || 'Improve and tidy this note without changing its meaning.',
      rules: [
        'Return the FULL updated note — every section that should remain, not only the ones you changed.',
        'You may edit, add, remove, or reorder sections and their items/rows to satisfy the request.',
        'Keep each section in the same shape it was given, and do not change a section\'s "type" unless explicitly asked.',
        'For "text" and "notes" sections, "content" is HTML — return valid HTML (markdown is also accepted and will be converted).',
        'Enum values: topics.status = new|open|inProgress|complete; risks.severity = low|medium|high|critical; risks.status = open|monitoring|mitigated|closed; tasks.status = planned|inProgress|complete|blocked. All dates are YYYY-MM-DD.',
      ].join(' '),
      output_format: [
        'Respond with ONLY a raw JSON object of the form {"sections": [ ...updated sections... ]}.',
        'No code fences, no text before or after.',
        ...(promptMode !== 'download' ? ['ZERO additional text. Start with { and end with }.'] : []),
      ].join(' '),
    },
    sections: sectionSpecs,
  }
}

// ─── Master Notes context prompt ─────────────────────────────────────────────

export function buildMasterNotesContextAIPrompt(customer, customerNotes, settings) {
  const notesContextDepth = settings?.notesContextDepth ?? 4
  const toneSettings = settings?.aiTone
  const langCode = settings?.language
  const langName = resolveLanguageName(langCode)

  const recentNotes = [...(customerNotes || [])]
    .filter((n) => !n.isDraft)
    .sort((a, b) => {
      const d = (b.date || '').localeCompare(a.date || '')
      return d !== 0 ? d : (b.updatedAt || '').localeCompare(a.updatedAt || '')
    })
    .slice(0, notesContextDepth)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  const masterNotes = customer.masterNotes || {}

  return {
    _version: '1',
    _type: 'master_notes_context_prompt',
    instructions: {
      task: `You have been given the master notes and recent meeting history for customer "${customer.name}". Use this as context when answering questions or completing tasks related to this customer.`,
      output_language: langName
        ? `Write ALL output content in ${langName}.`
        : undefined,
      tone: buildToneString(toneSettings),
    },
    customer: {
      name: customer.name || '',
    },
    master_notes: {
      standard: masterNotes.standard || '',
      ...(settings?.internalNotesEnabled && masterNotes.internal ? { internal: masterNotes.internal } : {}),
    },
    background_meetings: recentNotes.map((n) => ({
      date: n.date || '',
      title: n.title || 'Untitled',
      event_type: n.eventType || '',
      participants: (n.participants || [])
        .filter((p) => p.enabled !== false && p.name)
        .map((p) => ({ name: p.name, role: p.role || '' })),
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

// ─── Combined notes prompt (standard + internal in one export) ────────────────

export function buildCombinedNotesAIPrompt(standardSection, internalSection, note, allMeetingNotes, standardTone, internalTone, contextDepth = 4, promptMode = 'download') {
  const langName = resolveLanguageName(note.language)
  const contains = []
  if (standardSection) contains.push('standard')
  if (internalSection) contains.push('internal')

  const previousSessions = contextDepth > 0 && note.recurringMeetingId
    ? allMeetingNotes
        .filter((n) =>
          n.recurringMeetingId === note.recurringMeetingId &&
          n.id !== note.id &&
          !n.isDraft,
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

  const outputExample = contains.length === 2
    ? '{"standard": {"content": "## Meeting Notes\\n- Point one"}, "internal": {"content": "## Internal\\n- Confidential point"}}'
    : contains[0] === 'internal'
    ? '{"internal": {"content": "## Internal Notes\\n- Point one"}}'
    : '{"standard": {"content": "## Meeting Notes\\n- Point one"}}'

  return {
    _version: '1',
    _type: 'combined_notes_prompt',
    _contains: contains,
    instructions: {
      task: contains.length === 2
        ? 'Clean up and format the provided transcript or raw notes into structured notes for BOTH the standard section and the internal section. Each section has its own tone instruction — follow them independently.'
        : `Clean up and format the provided transcript or raw notes into structured notes for the ${contains[0] || 'notes'} section.`,
      context_rule: previousSessions.length > 0
        ? [
            `CRITICAL CONTEXT RULE: previous_sessions contains ${previousSessions.length} prior meeting(s) as READ-ONLY BACKGROUND CONTEXT.`,
            'Use them ONLY to understand recurring topics, running acronyms, ongoing decisions, and relationships.',
            `DO NOT write notes for previous sessions. Your output covers ONLY the current session on ${note.date || 'today'}.`,
          ].join(' ')
        : undefined,
      output_language: langName
        ? `Write ALL output content in ${langName}. This applies regardless of the transcript language.`
        : undefined,
      output_format: [
        'CRITICAL: Respond with ONLY a raw JSON object. No code fences (```), no introductory text, no explanation after.',
        'The response MUST start with { and end with }.',
        `Required format: ${outputExample}`,
        'Inside content strings, use markdown: ## for headings, - for bullets, - [ ] for open tasks, - [x] for done tasks, **bold** for key terms.',
        'If the transcript is absent, ask in plain text (not JSON) for the user to provide notes.',
        ...(promptMode !== 'download' ? ['ZERO additional text. Your entire message must be only the JSON object. Do not greet, do not explain, do not use code fences. Start your response with { and end with }.'] : []),
      ].join(' '),
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
    ...(standardSection ? {
      standard_section: {
        id: standardSection.id,
        label: standardSection.label || 'Notes',
        transcript: standardSection.content || '',
        tone: buildToneString(standardTone),
      },
    } : {}),
    ...(internalSection ? {
      internal_section: {
        id: internalSection.id,
        label: internalSection.label || 'Notes',
        transcript: internalSection.content || '',
        tone: buildToneString(internalTone),
      },
    } : {}),
  }
}

// Parse combined notes JSON response — returns { standard?, internal?, _raw? }
export function importCombinedNotesJsonResponse(jsonStr) {
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('Invalid JSON — could not parse the AI response.')
  }

  const result = {}
  if (typeof parsed?.standard?.content === 'string') result.standard = parsed.standard.content
  if (typeof parsed?.internal?.content === 'string') result.internal = parsed.internal.content
  // Fallback: single-section {"content": "..."} style
  if (!result.standard && !result.internal && typeof parsed?.content === 'string') result._raw = parsed.content

  if (!result.standard && !result.internal && !result._raw) {
    throw new Error('Expected {"standard": {"content": "..."}} or {"internal": {"content": "..."}} in the JSON response.')
  }

  return result
}

// ─── Combined notes + tasks prompt (master 4-panel export) ───────────────────

export function buildCombinedNotesAndTasksAIPrompt(
  standardSection,
  internalSection,
  standardTasksSection,
  internalTasksSection,
  note,
  allMeetingNotes,
  standardTone,
  internalTone,
  contextDepth = 4,
  promptMode = 'download',
  standardExtract = false,
  internalExtract = false,
) {
  const langName = resolveLanguageName(note.language)
  const contains = []
  if (standardSection) contains.push('standard_notes')
  if (internalSection) contains.push('internal_notes')
  if (standardTasksSection) contains.push('standard_tasks')
  if (internalTasksSection) contains.push('internal_tasks')

  const previousSessions = contextDepth > 0 && note.recurringMeetingId
    ? allMeetingNotes
        .filter((n) =>
          n.recurringMeetingId === note.recurringMeetingId &&
          n.id !== note.id &&
          !n.isDraft,
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

  const hasTasks = !!(standardTasksSection || internalTasksSection)
  const taskOutputExample = hasTasks
    ? ', "standard_tasks": [{"text": "task", "assignee": "name or empty", "status": "planned", "startDate": "", "endDate": ""}]'
    : ''
  const internalTasksExample = internalTasksSection
    ? ', "internal_tasks": [{"text": "task", "assignee": "", "status": "planned"}]'
    : ''
  const outputExample = `{"standard_notes": {"content": "## Notes\\n- Point one"}${internalSection ? ', "internal_notes": {"content": "## Internal\\n- Point"}' : ''}${taskOutputExample}${internalTasksExample}}`

  return {
    _version: '1',
    _type: 'combined_notes_tasks_prompt',
    _contains: contains,
    instructions: {
      task: [
        'Clean up and format the provided transcript or raw notes into structured output covering ALL of the following:',
        standardSection ? 'standard notes (customer-facing)' : null,
        internalSection ? 'internal notes (team-only)' : null,
        standardTasksSection ? (standardExtract ? 'standard tasks (extract action items from standard notes)' : 'standard tasks (structure the raw task input)') : null,
        internalTasksSection ? (internalExtract ? 'internal tasks (extract action items from internal notes)' : 'internal tasks (structure the raw task input)') : null,
      ].filter(Boolean).join(', ') + '.',
      no_duplicate_tasks_rule: (standardTasksSection || internalTasksSection)
        ? 'CRITICAL FOR TASKS: Each tasks section contains an existing_items array showing tasks ALREADY saved in the system. DO NOT include any of these existing tasks in your output — they are already there and will be duplicated if you repeat them. Only return tasks that are genuinely NEW and not already present in existing_items. Compare by task text before including any item.'
        : undefined,
      extract_standard_tasks_instruction: standardExtract && standardTasksSection
        ? 'For the standard task list: scan the standard notes transcript for explicit action items, to-dos, and commitments. Extract only NEW tasks not already in existing_items. Do not invent tasks not clearly stated.'
        : undefined,
      extract_internal_tasks_instruction: internalExtract && internalTasksSection
        ? 'For the internal task list: scan the internal notes transcript for explicit action items, to-dos, and commitments. Extract only NEW tasks not already in existing_items. Do not invent tasks not clearly stated.'
        : undefined,
      context_rule: previousSessions.length > 0
        ? [
            `CRITICAL CONTEXT RULE: previous_sessions contains ${previousSessions.length} prior meeting(s) as READ-ONLY BACKGROUND CONTEXT.`,
            'DO NOT write notes for previous sessions. Your output covers ONLY the current session.',
          ].join(' ')
        : undefined,
      output_language: langName
        ? `Write ALL output content in ${langName}.`
        : undefined,
      output_format: [
        'CRITICAL: Respond with ONLY a raw JSON object. No code fences, no explanatory text.',
        `Required format: ${outputExample}`,
        'For notes content strings, use markdown: ## headings, - bullets, **bold** for key terms.',
        'For task arrays, return ONLY new tasks not already in existing_items. Each item must have: text, assignee (string or empty), status (planned/inProgress/complete/blocked), startDate (YYYY-MM-DD or empty string — set if a start date is mentioned for this task), endDate (YYYY-MM-DD or empty string — set if a deadline or due date is mentioned for this task).',
        ...(promptMode !== 'download' ? ['ZERO additional text. Start with { and end with }.'] : []),
      ].join(' '),
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
    ...(standardSection ? {
      standard_notes_section: {
        id: standardSection.id,
        label: standardSection.label || 'Notes',
        transcript: standardSection.content || '',
        tone: buildToneString(standardTone),
      },
    } : {}),
    ...(internalSection ? {
      internal_notes_section: {
        id: internalSection.id,
        label: internalSection.label || 'Internal Notes',
        transcript: internalSection.content || '',
        tone: buildToneString(internalTone),
      },
    } : {}),
    ...(standardTasksSection ? {
      standard_tasks_section: {
        raw_input: standardExtract ? '' : (standardTasksSection.content || ''),
        existing_items: (standardTasksSection.items || []).map((i) => ({
          text: i.text || '', assignee: i.assignee || '', status: i.status || 'planned',
        })),
      },
    } : {}),
    ...(internalTasksSection ? {
      internal_tasks_section: {
        raw_input: internalExtract ? '' : (internalTasksSection.content || ''),
        existing_items: (internalTasksSection.items || []).map((i) => ({
          text: i.text || '', assignee: i.assignee || '', status: i.status || 'planned',
        })),
      },
    } : {}),
  }
}

// ─── Standalone tasks prompt (no meeting context) ────────────────────────────

export function buildStandaloneTasksAIPrompt(rawText, existingTasks = [], settings = {}, promptMode = 'download', customerNames = []) {
  const internalEnabled = !!settings?.internalNotesEnabled
  return {
    _version: '1',
    _type: 'standalone_tasks_prompt',
    instructions: {
      task: 'Extract or structure action items and tasks from the provided raw_input text.',
      no_duplicate_rule: existingTasks.length > 0
        ? 'CRITICAL: existing_tasks shows tasks ALREADY saved in the system. DO NOT include any of them in your output — they are already there. Only return tasks that are genuinely new and not already listed. Compare by task text before including any item.'
        : undefined,
      customer_assignment_rule: customerNames.length > 0
        ? `The known_customers field lists every customer/project name in the system. If the raw_input gives you context that a task belongs to one of them (e.g. it's mentioned by name, or the whole input is clearly about one customer), set that task's "customer" field to the EXACT matching name from known_customers. If you cannot tell which customer a task belongs to, leave "customer" as an empty string — do not guess.`
        : undefined,
      type_assignment_rule: internalEnabled
        ? 'Set each task\'s "type" field to "internal" if it reads as team-only / not meant for the customer to see (e.g. internal follow-ups, prep work, notes to self), or "standard" if it is customer-facing or has no such distinction. Default to "standard" when unsure.'
        : undefined,
      output_format: [
        'CRITICAL: Respond with ONLY a raw JSON object. No code fences.',
        `Required format: {"tasks": [{"text": "task description", "assignee": "name or empty string", "status": "planned", "startDate": "YYYY-MM-DD or empty string", "endDate": "YYYY-MM-DD or empty string"${customerNames.length > 0 ? ', "customer": "exact name from known_customers or empty string"' : ''}${internalEnabled ? ', "type": "standard or internal"' : ''}}]}`,
        'Status values: planned, inProgress, complete, blocked.',
        'startDate and endDate: fill in if a start date or deadline is mentioned for the task, otherwise use empty string.',
        ...(promptMode !== 'download' ? ['ZERO additional text. Start with { and end with }.'] : []),
      ].join(' '),
      tone: buildToneString(settings?.aiTone),
    },
    ...(customerNames.length > 0 ? { known_customers: customerNames } : {}),
    existing_tasks: existingTasks.map((t) => ({ text: t.text || '', status: t.status || 'planned' })),
    raw_input: rawText || '',
  }
}

// Parse combined notes + tasks JSON response
export function importCombinedNotesAndTasksJsonResponse(jsonStr) {
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('Invalid JSON — could not parse the AI response.')
  }

  const result = {}

  // Notes
  if (typeof parsed?.standard_notes?.content === 'string') result.standard_notes = parsed.standard_notes.content
  else if (typeof parsed?.standard?.content === 'string') result.standard_notes = parsed.standard.content
  if (typeof parsed?.internal_notes?.content === 'string') result.internal_notes = parsed.internal_notes.content
  else if (typeof parsed?.internal?.content === 'string') result.internal_notes = parsed.internal.content
  // Fallback
  if (!result.standard_notes && !result.internal_notes && typeof parsed?.content === 'string') result._raw = parsed.content

  // Tasks
  if (Array.isArray(parsed?.standard_tasks)) result.standard_tasks = parsed.standard_tasks
  if (Array.isArray(parsed?.internal_tasks)) result.internal_tasks = parsed.internal_tasks

  const hasNotes = result.standard_notes || result.internal_notes || result._raw
  const hasTasks = result.standard_tasks || result.internal_tasks
  if (!hasNotes && !hasTasks) {
    throw new Error('No notes or tasks found in the response. Check the AI output format.')
  }

  return result
}
