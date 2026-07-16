import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X, Plus, Users, Trash2, Pencil, Check, Copy, Mail, Sparkles, ChevronDown, ChevronRight, Brain } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useApp } from '../context/AppContext'

const GROUP_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#0f172a',
]

// ── Drag handle dot-grid icon ─────────────────────────────────────────────
function DragHandle(props) {
  return (
    <span
      {...props}
      style={{ ...props.style, display: 'inline-grid', gridTemplateColumns: '1fr 1fr', gap: '2px', cursor: 'grab', lineHeight: 0 }}
      title="Drag to move"
    >
      {[0,1,2,3,4,5].map(i => (
        <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
      ))}
    </span>
  )
}

// ── Draggable person wrapper ───────────────────────────────────────────────
function DraggablePerson({ personId, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: personId })
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.35 : 1 }}>
      {children({ dragHandleProps: { ...listeners, ...attributes } })}
    </div>
  )
}

// ── Droppable group zone ───────────────────────────────────────────────────
function DroppableZone({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className="rounded-lg transition-all duration-150"
      style={isOver ? { outline: '2px solid var(--accent)', outlineOffset: 2, background: 'rgba(var(--accent-rgb),0.04)' } : undefined}
    >
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ContactsModal({ entity, onClose }) {
  const { saveCustomer, recurringMeetings, customers } = useApp()

  const initList = entity.mailingList || { people: [], groups: [] }

  const participantSources = useMemo(() => {
    const out = []
    const seen = new Set()
    recurringMeetings
      .filter((m) => m.customerId === entity.id)
      .forEach((m) => {
        ;(m.participants || []).forEach((p) => {
          const key = (p.name || '').toLowerCase().trim()
          if (!p.isSelf && p.enabled !== false && key && !seen.has(key)) {
            seen.add(key)
            out.push({ name: p.name.trim(), position: p.role || '', company: p.firm || '' })
          }
        })
      })
    return out
  }, [recurringMeetings, entity.id])

  const mergeParticipants = (existing) => {
    const names = new Set(existing.map((p) => p.name.toLowerCase().trim()))
    const added = []
    participantSources.forEach((src) => {
      const key = src.name.toLowerCase().trim()
      if (!names.has(key)) {
        names.add(key)
        added.push({ id: uuid(), name: src.name, position: src.position, company: src.company || '', email: '', phone: '', managerId: '' })
      }
    })
    return added
  }

  const initialPeople = (() => {
    const existing = initList.people || []
    return [...existing, ...mergeParticipants(existing)]
  })()

  const [people, setPeople] = useState(initialPeople)
  const [groups, setGroups] = useState(initList.groups || [])
  const [activeTab, setActiveTab] = useState('contacts')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [copySuccess, setCopySuccess] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')
  const [activeDragId, setActiveDragId] = useState(null)

  // Person form state
  const [editingPerson, setEditingPerson] = useState(null)
  const [personForm, setPersonForm] = useState({ name: '', position: '', company: '', email: '', phone: '', managerId: '', managerCustom: '' })
  const [managerMode, setManagerMode] = useState('list')
  const nameInputRef = useRef(null)

  // Group form state
  const [editingGroup, setEditingGroup] = useState(null)
  const [groupForm, setGroupForm] = useState({ name: '', color: GROUP_COLORS[0] })
  const groupNameInputRef = useRef(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Auto-focus form inputs
  useEffect(() => { if (editingPerson && nameInputRef.current) nameInputRef.current.focus() }, [editingPerson])
  useEffect(() => { if (editingGroup && groupNameInputRef.current) groupNameInputRef.current.focus() }, [editingGroup])

  // Persist new participants on mount
  useEffect(() => {
    const existing = initList.people || []
    const added = mergeParticipants(existing)
    if (added.length > 0) {
      saveCustomer({ ...entity, mailingList: { people: [...existing, ...added], groups: initList.groups || [] } })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (newPeople, newGroups) => {
    const liveEntity = customers.find((c) => c.id === entity.id) || entity
    saveCustomer({ ...liveEntity, mailingList: { people: newPeople, groups: newGroups } })
  }

  // Group helpers
  const getPersonGroups = (personId) => groups.filter((g) => g.memberIds.includes(personId))
  const unassigned = people.filter((p) => !groups.some((g) => g.memberIds.includes(p.id)))

  // Selection helpers
  const toggleSelect = (id) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = () => setSelectedIds(new Set(people.map((p) => p.id)))
  const deselectAll = () => setSelectedIds(new Set())
  const selectGroup = (g) => setSelectedIds((prev) => { const n = new Set(prev); g.memberIds.forEach((id) => n.add(id)); return n })
  const deselectGroup = (g) => setSelectedIds((prev) => { const n = new Set(prev); g.memberIds.forEach((id) => n.delete(id)); return n })
  const isGroupFull = (g) => g.memberIds.length > 0 && g.memberIds.every((id) => selectedIds.has(id))
  const isGroupPartial = (g) => g.memberIds.some((id) => selectedIds.has(id)) && !isGroupFull(g)
  const isUnassignedFull = () => unassigned.length > 0 && unassigned.every((p) => selectedIds.has(p.id))
  const isUnassignedPartial = () => unassigned.some((p) => selectedIds.has(p.id)) && !isUnassignedFull()

  // Copy emails
  const copyEmails = () => {
    const emails = people.filter((p) => selectedIds.has(p.id) && p.email).map((p) => p.email)
    navigator.clipboard.writeText(emails.join('; ')).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    })
  }

  // Build & copy AI prompt for the mailing list
  const copyMailingListPrompt = () => {
    const getPersonGroupNames = (personId) => groups.filter((g) => g.memberIds.includes(personId)).map((g) => g.name)
    const hasUnassigned = people.some((p) => !groups.some((g) => g.memberIds.includes(p.id)))
    const missingWarnings = []
    if (groups.length === 0) missingWarnings.push('No groups have been defined yet — please ask what groups or segments to use.')
    else if (hasUnassigned) missingWarnings.push('Some contacts are not assigned to any group.')
    if (people.some((p) => !p.email)) missingWarnings.push('Some contacts are missing email addresses.')
    if (people.some((p) => !p.position)) missingWarnings.push('Some contacts are missing position/role.')
    if (people.some((p) => !p.company)) missingWarnings.push('Some contacts are missing company/organisation.')

    const prompt = {
      _type: 'mailing_list_prompt',
      organisation: entity.name,
      instructions: missingWarnings.length > 0
        ? 'Review the contact list below. IMPORTANT: collect ALL clarifying questions into a single message first, then wait for answers before generating any output.'
        : 'Review the contact list below. All data looks complete — you may proceed to generate the updated JSON directly.',
      missing_data_warnings: missingWarnings,
      contacts: people.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email || '',
        position: p.position || '',
        company: p.company || '',
        phone: p.phone || '',
        manager: getManagerName(p) || '',
        groups: getPersonGroupNames(p.id),
      })),
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color || '',
        members: people.filter((p) => g.memberIds.includes(p.id)).map((p) => p.name),
      })),
      expected_output: {
        description: 'Return the complete updated contact list as JSON wrapped in ```json ... ``` fences. Preserve all existing IDs.',
        schema: {
          people: [{ id: '(preserve)', name: '', email: '', position: '', company: '', phone: '', managerId: '' }],
          groups: [{ id: '(preserve)', name: '', color: '#hex', memberIds: ['person-id'] }],
        },
      },
    }
    navigator.clipboard.writeText(JSON.stringify(prompt, null, 2)).then(() => {
      setPromptCopied(true)
      setImportOpen(true)
      setTimeout(() => setPromptCopied(false), 2500)
    })
  }

  // Import JSON response from AI
  const handleImportJson = () => {
    const stripped = importText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    try {
      const parsed = JSON.parse(stripped)
      if (!parsed.people || !Array.isArray(parsed.people)) { setImportError('JSON must have a "people" array.'); return }
      const newPeople = parsed.people.map((p) => ({
        id: p.id || uuid(),
        name: p.name || '',
        position: p.position || '',
        company: p.company || '',
        email: p.email || '',
        phone: p.phone || '',
        managerId: p.managerId || '',
      }))
      const newGroups = Array.isArray(parsed.groups)
        ? parsed.groups.map((g) => ({
            id: g.id || uuid(),
            name: g.name || '',
            color: g.color || GROUP_COLORS[0],
            memberIds: Array.isArray(g.memberIds) ? g.memberIds.filter((id) => newPeople.some((p) => p.id === id)) : [],
          }))
        : groups
      setPeople(newPeople)
      setGroups(newGroups)
      persist(newPeople, newGroups)
      setImportText('')
      setImportError('')
      setImportSuccess(`Imported ${newPeople.length} contacts and ${newGroups.length} groups.`)
      setTimeout(() => setImportSuccess(''), 4000)
    } catch {
      setImportError('Invalid JSON — check the response format.')
    }
  }

  // Drag-and-drop handler
  const handleDragStart = ({ active }) => setActiveDragId(active.id)
  const handleDragEnd = ({ active, over }) => {
    setActiveDragId(null)
    if (!over) return
    const personId = active.id
    const targetId = over.id // group id or 'unassigned'
    const fromGroup = groups.find((g) => g.memberIds.includes(personId))
    const fromId = fromGroup ? fromGroup.id : 'unassigned'
    if (fromId === targetId) return
    const newGroups = groups.map((g) => {
      if (g.id === fromId) return { ...g, memberIds: g.memberIds.filter((id) => id !== personId) }
      if (g.id === targetId) return { ...g, memberIds: [...g.memberIds, personId] }
      return g
    })
    setGroups(newGroups)
    persist(people, newGroups)
  }

  // Person CRUD
  const startAddPerson = () => {
    setPersonForm({ name: '', position: '', company: '', email: '', phone: '', managerId: '', managerCustom: '' })
    setManagerMode('list')
    setEditingGroup(null)
    setEditingPerson('new')
    setActiveTab('contacts')
  }
  const startEditPerson = (person) => {
    const inList = people.find((p) => p.id === person.managerId)
    setPersonForm({
      name: person.name,
      position: person.position || '',
      company: person.company || '',
      email: person.email || '',
      phone: person.phone || '',
      managerId: inList ? person.managerId : '',
      managerCustom: !inList && person.managerId ? person.managerId : '',
    })
    setManagerMode(inList || !person.managerId ? 'list' : 'custom')
    setEditingGroup(null)
    setEditingPerson(person.id)
    setActiveTab('contacts')
  }
  const cancelEditPerson = () => setEditingPerson(null)
  const savePerson = () => {
    if (!personForm.name.trim()) return
    const managerId = managerMode === 'custom' ? personForm.managerCustom || '' : personForm.managerId || ''
    let newPeople
    if (editingPerson === 'new') {
      newPeople = [...people, { id: uuid(), name: personForm.name.trim(), position: personForm.position, company: personForm.company, email: personForm.email, phone: personForm.phone, managerId }]
    } else {
      newPeople = people.map((p) =>
        p.id === editingPerson ? { ...p, name: personForm.name.trim(), position: personForm.position, company: personForm.company, email: personForm.email, phone: personForm.phone, managerId } : p
      )
    }
    setPeople(newPeople)
    persist(newPeople, groups)
    setEditingPerson(null)
  }
  const deletePerson = (id) => {
    const newPeople = people.filter((p) => p.id !== id)
    const newGroups = groups.map((g) => ({ ...g, memberIds: g.memberIds.filter((mid) => mid !== id) }))
    setPeople(newPeople)
    setGroups(newGroups)
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    persist(newPeople, newGroups)
    if (editingPerson === id) setEditingPerson(null)
  }

  // Group CRUD
  const startAddGroup = () => {
    setGroupForm({ name: '', color: GROUP_COLORS[0] })
    setEditingPerson(null)
    setEditingGroup('new')
  }
  const startEditGroup = (group) => {
    setGroupForm({ name: group.name, color: group.color || GROUP_COLORS[0] })
    setEditingPerson(null)
    setEditingGroup(group.id)
  }
  const cancelEditGroup = () => setEditingGroup(null)
  const saveGroup = () => {
    if (!groupForm.name.trim()) return
    let newGroups
    if (editingGroup === 'new') {
      newGroups = [...groups, { id: uuid(), name: groupForm.name.trim(), color: groupForm.color || null, memberIds: [] }]
    } else {
      newGroups = groups.map((g) => g.id === editingGroup ? { ...g, name: groupForm.name.trim(), color: groupForm.color || null } : g)
    }
    setGroups(newGroups)
    persist(people, newGroups)
    setEditingGroup(null)
  }
  const deleteGroup = (id) => {
    const newGroups = groups.filter((g) => g.id !== id)
    setGroups(newGroups)
    persist(people, newGroups)
    if (editingGroup === id) setEditingGroup(null)
  }
  const toggleMember = (groupId, personId) => {
    const newGroups = groups.map((g) => {
      if (g.id !== groupId) return g
      return g.memberIds.includes(personId)
        ? { ...g, memberIds: g.memberIds.filter((id) => id !== personId) }
        : { ...g, memberIds: [...g.memberIds, personId] }
    })
    setGroups(newGroups)
    persist(people, newGroups)
  }

  const getManagerName = (person) => {
    const m = people.find((p) => p.id === person.managerId)
    return m ? m.name : person.managerId || ''
  }

  const selectedCount = selectedIds.size
  const selectedWithEmail = people.filter((p) => selectedIds.has(p.id) && p.email).length
  const activePerson = activeDragId ? people.find((p) => p.id === activeDragId) : null

  // ── Render helpers (functions, not components, to avoid re-mount bugs) ────

  const renderPersonRow = (person, showEmail, withDrag = false) => (
    <div key={person.id} className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group ${showEmail ? 'border border-gray-100 dark:border-gray-700 mb-1.5' : 'mb-0.5'}`}>
      {withDrag && (
        <DraggablePerson personId={person.id}>
          {({ dragHandleProps }) => (
            <DragHandle
              {...dragHandleProps}
              className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
        </DraggablePerson>
      )}
      {showEmail && (
        <button
          onClick={() => toggleSelect(person.id)}
          className="shrink-0 rounded-full border-2 transition-all flex items-center justify-center"
          style={selectedIds.has(person.id)
            ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', width: 18, height: 18 }
            : { borderColor: '#d1d5db', width: 18, height: 18 }}
        >
          {selectedIds.has(person.id) && <Check size={9} className="text-white" />}
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{person.name}</span>
          {person.position && <span className="text-xs text-gray-400 dark:text-gray-500 leading-tight">{person.position}</span>}
          {!showEmail && getPersonGroups(person.id).map((g) => (
            <span key={g.id} className="text-xs px-1.5 py-0.5 rounded-full font-medium text-white leading-tight" style={{ backgroundColor: g.color || '#6b7280' }}>
              {g.name}
            </span>
          ))}
        </div>
        {getManagerName(person) && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Reports to: {getManagerName(person)}</p>
        )}
        {showEmail && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {person.email || <span className="italic">No email</span>}
            {person.company && <span className="ml-2 text-gray-300 dark:text-gray-600">· {person.company}</span>}
          </p>
        )}
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => startEditPerson(person)} className="p-1 text-gray-400 hover:text-sky-500 transition-colors" title="Edit"><Pencil size={11} /></button>
        <button onClick={() => deletePerson(person.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={11} /></button>
      </div>
    </div>
  )

  const renderPersonForm = () => (
    <div className="p-4 rounded-xl border-2 border-accent/30 bg-accent/5 space-y-3 mt-2">
      <p className="text-xs font-semibold text-accent uppercase tracking-wider">{editingPerson === 'new' ? 'Add Contact' : 'Edit Contact'}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Name *</label>
          <input
            ref={nameInputRef}
            className="input text-sm"
            placeholder="Full name"
            value={personForm.name}
            onChange={(e) => setPersonForm((f) => ({ ...f, name: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && savePerson()}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Position</label>
          <input className="input text-sm" placeholder="Job title" value={personForm.position} onChange={(e) => setPersonForm((f) => ({ ...f, position: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Company</label>
          <input className="input text-sm" placeholder="Organisation / company" value={personForm.company} onChange={(e) => setPersonForm((f) => ({ ...f, company: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Email</label>
          <input className="input text-sm" type="email" placeholder="email@example.com" value={personForm.email} onChange={(e) => setPersonForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Phone</label>
          <input className="input text-sm" type="tel" placeholder="+1 555 000 0000" value={personForm.phone} onChange={(e) => setPersonForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Manager</label>
          <select
            className="input text-sm"
            value={managerMode === 'custom' ? '__custom__' : personForm.managerId}
            onChange={(e) => {
              if (e.target.value === '__custom__') setManagerMode('custom')
              else { setManagerMode('list'); setPersonForm((f) => ({ ...f, managerId: e.target.value })) }
            }}
          >
            <option value="">No manager</option>
            {people.filter((p) => p.id !== editingPerson).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            <option value="__custom__">+ Type a name…</option>
          </select>
          {managerMode === 'custom' && (
            <input className="input text-sm mt-2" placeholder="Manager name" value={personForm.managerCustom} onChange={(e) => setPersonForm((f) => ({ ...f, managerCustom: e.target.value }))} />
          )}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost text-sm" onClick={cancelEditPerson}>Cancel</button>
        <button className="btn-primary text-sm" onClick={savePerson}>Save</button>
      </div>
    </div>
  )

  const renderGroupForm = () => (
    <div className="p-4 rounded-xl border-2 border-accent/30 bg-accent/5 space-y-3 mt-2">
      <p className="text-xs font-semibold text-accent uppercase tracking-wider">{editingGroup === 'new' ? 'Add Group' : 'Edit Group'}</p>
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Group Name *</label>
        <input
          ref={groupNameInputRef}
          className="input text-sm"
          placeholder="e.g. Engineering Team"
          value={groupForm.name}
          onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && saveGroup()}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">Colour</label>
        <div className="flex gap-2 flex-wrap">
          {GROUP_COLORS.map((color) => (
            <button key={color} onClick={() => setGroupForm((f) => ({ ...f, color }))} className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center shrink-0" style={{ backgroundColor: color }}>
              {groupForm.color === color && <Check size={10} className="text-white" />}
            </button>
          ))}
        </div>
      </div>
      {editingGroup !== 'new' && people.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Members</label>
          <div className="space-y-0.5 max-h-36 overflow-y-auto pr-1">
            {people.map((person) => {
              const currentGroup = groups.find((g) => g.id === editingGroup)
              return (
                <label key={person.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-1.5 rounded-md">
                  <input type="checkbox" checked={currentGroup ? currentGroup.memberIds.includes(person.id) : false} onChange={() => toggleMember(editingGroup, person.id)} className="accent-accent shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{person.name}</span>
                  {person.position && <span className="text-xs text-gray-400 dark:text-gray-500">{person.position}</span>}
                </label>
              )
            })}
          </div>
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost text-sm" onClick={cancelEditGroup}>Cancel</button>
        <button className="btn-primary text-sm" onClick={saveGroup}>Save</button>
      </div>
    </div>
  )

  const groupBtnClass = (full, partial) =>
    `text-xs px-2.5 py-1 rounded-md font-medium transition-colors border shrink-0 ${
      full ? 'bg-accent text-[color:var(--accent-contrast)] border-accent'
      : partial ? 'bg-accent/15 text-accent border-accent/30'
      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-accent hover:border-accent/30'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={onClose} />
      <div className="relative dropdown-panel rounded-2xl w-full max-w-3xl mx-4 flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="p-2 bg-accent/10 rounded-lg shrink-0">
            <Users size={16} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 dark:text-white text-base leading-tight">Contacts</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{entity.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 shrink-0 px-6">
          {[{ id: 'contacts', label: `Contacts (${people.length})` }, { id: 'mailingList', label: 'Mailing List' }].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Contacts Tab ──────────────────────────────────────────────── */}
          {activeTab === 'contacts' && (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="p-6 space-y-5">
                {people.length === 0 && !editingPerson && !editingGroup && (
                  <div className="text-center py-12">
                    <Users size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm text-gray-400 dark:text-gray-500">No contacts yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add people manually, or set up recurring meetings with participants — they appear here automatically.</p>
                  </div>
                )}

                {/* Groups */}
                {groups.map((group) => {
                  const members = people.filter((p) => group.memberIds.includes(p.id))
                  return (
                    <div key={group.id}>
                      <div className="flex items-center gap-2 mb-2 group/hdr">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color || '#6b7280' }} />
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">{group.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">· {members.length}</span>
                        <div className="flex gap-0.5 ml-1 opacity-0 group-hover/hdr:opacity-100 transition-opacity">
                          <button onClick={() => startEditGroup(group)} className="p-1 text-gray-400 hover:text-sky-500 transition-colors" title="Edit group"><Pencil size={10} /></button>
                          <button onClick={() => deleteGroup(group.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete group"><Trash2 size={10} /></button>
                        </div>
                      </div>
                      <DroppableZone id={group.id}>
                        <div className="pl-4 min-h-[28px]">
                          {members.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1">No members — drag contacts here or edit this group.</p>
                          ) : (
                            members.map((p) => (
                              <DraggablePerson key={p.id} personId={p.id}>
                                {({ dragHandleProps }) => (
                                  <div className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group mb-0.5`}>
                                    <DragHandle {...dragHandleProps} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-baseline gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{p.name}</span>
                                        {p.position && <span className="text-xs text-gray-400 dark:text-gray-500 leading-tight">{p.position}</span>}
                                      </div>
                                      {getManagerName(p) && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Reports to: {getManagerName(p)}</p>}
                                    </div>
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                      <button onClick={() => startEditPerson(p)} className="p-1 text-gray-400 hover:text-sky-500 transition-colors" title="Edit"><Pencil size={11} /></button>
                                      <button onClick={() => deletePerson(p.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={11} /></button>
                                    </div>
                                  </div>
                                )}
                              </DraggablePerson>
                            ))
                          )}
                        </div>
                      </DroppableZone>
                    </div>
                  )
                })}

                {/* Unassigned */}
                {(unassigned.length > 0 || groups.length > 0) && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Unassigned</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">· {unassigned.length}</span>
                    </div>
                    <DroppableZone id="unassigned">
                      <div className="pl-4 min-h-[28px]">
                        {unassigned.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1">Drop contacts here to unassign them.</p>
                        ) : (
                          unassigned.map((p) => (
                            <DraggablePerson key={p.id} personId={p.id}>
                              {({ dragHandleProps }) => (
                                <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group mb-0.5">
                                  <DragHandle {...dragHandleProps} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                      <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{p.name}</span>
                                      {p.position && <span className="text-xs text-gray-400 dark:text-gray-500 leading-tight">{p.position}</span>}
                                      {getPersonGroups(p.id).map((g) => (
                                        <span key={g.id} className="text-xs px-1.5 py-0.5 rounded-full font-medium text-white leading-tight" style={{ backgroundColor: g.color || '#6b7280' }}>{g.name}</span>
                                      ))}
                                    </div>
                                    {getManagerName(p) && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Reports to: {getManagerName(p)}</p>}
                                  </div>
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <button onClick={() => startEditPerson(p)} className="p-1 text-gray-400 hover:text-sky-500 transition-colors" title="Edit"><Pencil size={11} /></button>
                                    <button onClick={() => deletePerson(p.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={11} /></button>
                                  </div>
                                </div>
                              )}
                            </DraggablePerson>
                          ))
                        )}
                      </div>
                    </DroppableZone>
                  </div>
                )}

                {/* Person form */}
                {editingPerson && renderPersonForm()}

                {/* Group form */}
                {editingGroup && !editingPerson && renderGroupForm()}

                {/* Action buttons */}
                {!editingPerson && !editingGroup && (
                  <div className="flex gap-2 pt-1">
                    <button className="flex-1 py-2 text-sm text-gray-400 hover:text-accent border border-dashed border-gray-200 dark:border-gray-700 hover:border-accent/50 rounded-xl transition-colors flex items-center justify-center gap-1.5" onClick={startAddPerson}>
                      <Plus size={13} /> Add Contact
                    </button>
                    <button className="flex-1 py-2 text-sm text-gray-400 hover:text-accent border border-dashed border-gray-200 dark:border-gray-700 hover:border-accent/50 rounded-xl transition-colors flex items-center justify-center gap-1.5" onClick={startAddGroup}>
                      <Plus size={13} /> Add Group
                    </button>
                  </div>
                )}
              </div>

              {/* Drag overlay — ghost card while dragging */}
              <DragOverlay>
                {activePerson && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-accent/30 text-sm font-medium text-gray-900 dark:text-white">
                    {activePerson.name}
                    {activePerson.position && <span className="text-xs text-gray-400 dark:text-gray-500">{activePerson.position}</span>}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* ── Mailing List Tab ──────────────────────────────────────────── */}
          {activeTab === 'mailingList' && (
            <div className="p-6 space-y-3">
              {people.length === 0 ? (
                <div className="text-center py-12">
                  <Mail size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">No contacts yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add contacts in the Contacts tab first.</p>
                </div>
              ) : (
                <>
                  {groups.map((group) => {
                    const members = people.filter((p) => group.memberIds.includes(p.id))
                    const full = isGroupFull(group)
                    const partial = isGroupPartial(group)
                    return (
                      <div key={group.id} className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color || '#6b7280' }} />
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex-1 uppercase tracking-wide">{group.name}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</span>
                          <button onClick={() => full ? deselectGroup(group) : selectGroup(group)} className={groupBtnClass(full, partial)}>
                            {full ? 'Deselect' : 'Select all'}
                          </button>
                        </div>
                        <div className="px-4 py-2">
                          {members.length === 0
                            ? <p className="text-xs text-gray-400 dark:text-gray-500 py-1 text-center italic">No members</p>
                            : members.map((p) => renderPersonRow(p, true, false))}
                        </div>
                      </div>
                    )
                  })}

                  {unassigned.length > 0 && (
                    <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 flex-1 uppercase tracking-wide">Unassigned</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{unassigned.length}</span>
                        <button
                          onClick={() => {
                            if (isUnassignedFull()) setSelectedIds((prev) => { const n = new Set(prev); unassigned.forEach((p) => n.delete(p.id)); return n })
                            else setSelectedIds((prev) => { const n = new Set(prev); unassigned.forEach((p) => n.add(p.id)); return n })
                          }}
                          className={groupBtnClass(isUnassignedFull(), isUnassignedPartial())}
                        >
                          {isUnassignedFull() ? 'Deselect' : 'Select all'}
                        </button>
                      </div>
                      <div className="px-4 py-2">
                        {unassigned.map((p) => renderPersonRow(p, true, false))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Import JSON panel */}
              {importOpen && (
                <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 space-y-3 bg-gray-50/50 dark:bg-gray-800/30">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Paste AI Response (JSON)</p>
                  <textarea
                    className="input text-xs font-mono resize-none w-full"
                    rows={5}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={'Paste the JSON from your AI assistant here:\n{"people": [...], "groups": [...]}'}
                    autoFocus
                  />
                  {importError && <p className="text-xs text-red-500 dark:text-red-400">{importError}</p>}
                  {importSuccess && <p className="text-xs text-green-600 dark:text-green-400">{importSuccess}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleImportJson} className="btn-primary flex items-center gap-1.5 text-xs py-1 px-3">
                      <Brain size={12} /> Apply to Contacts
                    </button>
                    <button onClick={() => { setImportOpen(false); setImportText(''); setImportError('') }} className="btn-ghost text-xs py-1 px-3">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center gap-3 shrink-0 flex-wrap">
          {activeTab === 'mailingList' ? (
            <>
              <button className="btn-secondary text-xs py-1.5 shrink-0" onClick={selectAll}>Select All</button>
              <button className="btn-ghost text-xs py-1.5 shrink-0" onClick={deselectAll}>Deselect All</button>
              <span className="flex-1 text-xs text-gray-400 dark:text-gray-500 min-w-0">
                {selectedCount > 0 ? `${selectedCount} selected · ${selectedWithEmail} with email` : 'None selected'}
              </span>
              <button
                className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 shrink-0"
                onClick={() => { setImportOpen((v) => !v); setImportError('') }}
                title="Import updated contacts from AI JSON response"
              >
                <Brain size={12} className="text-purple-500" />
                {importOpen ? 'Close Import' : 'Import JSON'}
                {importOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
              <button
                className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 shrink-0"
                onClick={copyMailingListPrompt}
                title="Copy AI prompt with your mailing list data"
              >
                {promptCopied ? <Check size={12} /> : <Sparkles size={12} />}
                {promptCopied ? 'Copied!' : 'Copy AI Prompt'}
              </button>
              <button
                className="btn-primary text-sm flex items-center gap-2 shrink-0"
                onClick={copyEmails}
                disabled={selectedWithEmail === 0}
                style={{ opacity: selectedWithEmail === 0 ? 0.5 : 1, cursor: selectedWithEmail === 0 ? 'not-allowed' : 'pointer' }}
              >
                {copySuccess ? <Check size={14} /> : <Copy size={14} />}
                {copySuccess ? 'Copied!' : 'Copy Emails'}
              </button>
            </>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 flex-1">
              {people.length} contact{people.length !== 1 ? 's' : ''} · Drag contacts between groups · Switch to Mailing List to copy emails
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
