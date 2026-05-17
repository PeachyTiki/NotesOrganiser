import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  Plus, FileEdit, ChevronRight, ChevronDown, Search, Sparkles,
  Folder, FolderOpen, Pencil, Trash2, Check, X, Building2, ArrowUpDown, BookMarked,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useApp } from '../../context/AppContext'
import RecurringMeetingEditor, { scheduleLabel } from './RecurringMeetingEditor'
import MeetingNoteEditor from './MeetingNoteEditor'
import MasterNotesModal from '../MasterNotesModal'

function isScheduledToday(schedule) {
  if (!schedule || !schedule.type || schedule.type === 'none') return false
  const today = new Date()
  const dow = today.getDay()
  const dom = today.getDate()

  if (schedule.type === 'weekly' || schedule.type === 'biweekly') {
    return (schedule.dayOfWeek ?? -1) === dow
  }
  if (schedule.type === 'monthly-date') {
    return (schedule.dateOfMonth ?? -1) === dom
  }
  if (schedule.type === 'monthly-weekday') {
    if ((schedule.dayOfWeek ?? -1) !== dow) return false
    const year = today.getFullYear()
    const month = today.getMonth()
    if (schedule.weekOfMonth === 'last') {
      return new Date(year, month, dom + 7).getMonth() !== month
    }
    const firstDow = new Date(year, month, 1).getDay()
    const offset = (dow - firstDow + 7) % 7
    const occurrence = Math.floor((dom - 1 - offset) / 7) + 1
    return occurrence === schedule.weekOfMonth
  }
  return false
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MeetingsPage() {
  const {
    recurringMeetings, meetingNotes, customers,
    saveCustomer, deleteCustomer, saveRecurringMeeting, t,
  } = useApp()

  const [view, setView] = useState('list')
  const [editingMeeting, setEditingMeeting] = useState(null)
  const [prefilledCustomer, setPrefilledCustomer] = useState(null)
  const [prefilledCustomerId, setPrefilledCustomerId] = useState(null)
  const [noteConfig, setNoteConfig] = useState(null)
  const [masterNotesCustomer, setMasterNotesCustomer] = useState(null)
  const [filterDrafts, setFilterDrafts] = useState(false)
  const [search, setSearch] = useState('')
  const [meetingSort, setMeetingSort] = useState('name_asc')
  const [filterHasNotes, setFilterHasNotes] = useState(false)
  const [filterToday, setFilterToday] = useState(false)
  const [openCustomers, setOpenCustomers] = useState({})
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [addingCustomerType, setAddingCustomerType] = useState('customer')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal, setRenameVal] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [addingSubOf, setAddingSubOf] = useState(null)
  const [newSubName, setNewSubName] = useState('')
  const [editingEmojiFor, setEditingEmojiFor] = useState(null)
  const [emojiVal, setEmojiVal] = useState('')

  const newCustomerInputRef = useRef(null)
  const renameInputRef = useRef(null)
  const newSubInputRef = useRef(null)
  const emojiInputRef = useRef(null)

  useEffect(() => {
    if (addingCustomer && newCustomerInputRef.current) newCustomerInputRef.current.focus()
  }, [addingCustomer])

  useEffect(() => {
    if (renamingId && renameInputRef.current) renameInputRef.current.select()
  }, [renamingId])

  useEffect(() => {
    if (addingSubOf && newSubInputRef.current) newSubInputRef.current.focus()
  }, [addingSubOf])

  useEffect(() => {
    if (editingEmojiFor && emojiInputRef.current) emojiInputRef.current.focus()
  }, [editingEmojiFor])

  const noteCountById = useMemo(() => {
    const m = {}
    meetingNotes.forEach((n) => {
      if (n.recurringMeetingId && !n.isDraft) m[n.recurringMeetingId] = (m[n.recurringMeetingId] || 0) + 1
    })
    return m
  }, [meetingNotes])

  const draftNotesByMeetingId = useMemo(() => {
    const m = {}
    meetingNotes.forEach((n) => {
      if (n.isDraft && n.recurringMeetingId) {
        if (!m[n.recurringMeetingId]) m[n.recurringMeetingId] = []
        m[n.recurringMeetingId].push(n)
      }
    })
    return m
  }, [meetingNotes])

  const latestNoteById = useMemo(() => {
    const m = {}
    meetingNotes.forEach((n) => {
      if (!n.recurringMeetingId || n.isDraft) return
      const ts = n.updatedAt || n.createdAt || n.date || ''
      if (!m[n.recurringMeetingId] || ts > m[n.recurringMeetingId]) m[n.recurringMeetingId] = ts
    })
    return m
  }, [meetingNotes])

  // All notes grouped by customer name (for AI context export in master notes)
  const notesByCustomer = useMemo(() => {
    const m = {}
    meetingNotes.forEach((n) => {
      const custName = (n.recurringMeetingId && recurringMeetings.find((r) => r.id === n.recurringMeetingId)?.customer)
        || n.customer || ''
      if (!custName) return
      if (!m[custName]) m[custName] = []
      m[custName].push(n)
    })
    return m
  }, [meetingNotes, recurringMeetings])

  // Filter meetings by search
  const filteredMeetings = useMemo(() => {
    if (!search.trim()) return recurringMeetings
    const q = search.toLowerCase()
    return recurringMeetings.filter((m) =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.customer || '').toLowerCase().includes(q) ||
      (m.eventType || '').toLowerCase().includes(q) ||
      (m.team || '').toLowerCase().includes(q) ||
      (scheduleLabel(m.schedule) || '').toLowerCase().includes(q)
    )
  }, [recurringMeetings, search])

  // Sort + filter helper (reused for each meeting list)
  const sortAndFilter = useMemo(() => (list) => {
    let out = list
    if (filterHasNotes) out = out.filter((m) => (noteCountById[m.id] || 0) > 0)
    if (filterToday) out = out.filter((m) => isScheduledToday(m.schedule))
    if (filterDrafts) out = out.filter((m) => (draftNotesByMeetingId[m.id] || []).length > 0)
    const sorted = [...out]
    sorted.sort((a, b) => {
      switch (meetingSort) {
        case 'name_desc':       return (b.name || '').localeCompare(a.name || '')
        case 'most_notes':      return (noteCountById[b.id] || 0) - (noteCountById[a.id] || 0)
        case 'recently_active': return (latestNoteById[b.id] || '').localeCompare(latestNoteById[a.id] || '')
        case 'no_notes':        return (noteCountById[a.id] || 0) - (noteCountById[b.id] || 0)
        default:                return (a.name || '').localeCompare(b.name || '')
      }
    })
    return sorted
  }, [filterHasNotes, filterToday, filterDrafts, meetingSort, noteCountById, latestNoteById, draftNotesByMeetingId])

  // New computed data
  const topLevelEntities = useMemo(() => {
    let list = customers.filter((c) => !c.parentId)
    if (typeFilter !== 'all') list = list.filter((c) => c.type === typeFilter)
    return list.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [customers, typeFilter])

  const subEntitiesOf = useMemo(() => {
    const map = {}
    customers.filter((c) => c.parentId).forEach((c) => {
      if (!map[c.parentId]) map[c.parentId] = []
      map[c.parentId].push(c)
    })
    // sort each list by name
    Object.keys(map).forEach((k) => map[k].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    return map
  }, [customers])

  // Build a set of all entity IDs for legacy check
  const entityIdSet = useMemo(() => new Set(customers.map((c) => c.id)), [customers])

  const meetingsByEntityId = useMemo(() => {
    const map = {}
    filteredMeetings.forEach((m) => {
      const key = (m.customerId && entityIdSet.has(m.customerId)) ? m.customerId : '__misc__'
      if (!map[key]) map[key] = []
      map[key].push(m)
    })
    return map
  }, [filteredMeetings, entityIdSet])

  const miscMeetings = useMemo(() => {
    return sortAndFilter(meetingsByEntityId['__misc__'] || [])
  }, [meetingsByEntityId, sortAndFilter])

  // Today's meetings (across all customers)
  const todayMeetings = useMemo(
    () => filteredMeetings.filter((m) => isScheduledToday(m.schedule)),
    [filteredMeetings]
  )

  // All hooks declared — conditional returns safe below

  if (view === 'editRecurring') {
    return (
      <RecurringMeetingEditor
        meeting={editingMeeting}
        prefilledCustomer={prefilledCustomer}
        prefilledCustomerId={prefilledCustomerId}
        onClose={() => { setView('list'); setEditingMeeting(null); setPrefilledCustomer(null); setPrefilledCustomerId(null) }}
      />
    )
  }

  if (view === 'newNote') {
    return (
      <MeetingNoteEditor
        recurringMeetingId={noteConfig?.recurringMeetingId}
        existingNote={noteConfig?.existingNote}
        prefilledCustomer={noteConfig?.prefilledCustomer}
        onClose={() => { setView('list'); setNoteConfig(null) }}
      />
    )
  }

  const toggleCustomer = (id) => setOpenCustomers((s) => ({ ...s, [id]: !s[id] }))

  const handleAddCustomer = (type = 'customer') => {
    const name = newCustomerName.trim()
    if (!name) return
    const id = uuid()
    saveCustomer({ id, name, type, emoji: '', parentId: null, createdAt: new Date().toISOString() })
    setOpenCustomers((s) => ({ ...s, [id]: true }))
    setNewCustomerName('')
    setAddingCustomer(false)
  }

  const handleAddSub = (parentId) => {
    const name = newSubName.trim()
    if (!name) return
    const parent = customers.find((c) => c.id === parentId)
    const id = uuid()
    saveCustomer({ id, name, type: parent?.type || 'customer', emoji: '', parentId, createdAt: new Date().toISOString() })
    setOpenCustomers((s) => ({ ...s, [id]: true }))
    setNewSubName('')
    setAddingSubOf(null)
  }

  const handleDeleteCustomer = (customer) => {
    // Count meetings assigned to this entity
    const directCount = recurringMeetings.filter((m) => m.customerId === customer.id).length
    const subs = subEntitiesOf[customer.id] || []
    const subMeetingCount = subs.reduce((acc, sub) =>
      acc + recurringMeetings.filter((m) => m.customerId === sub.id).length, 0)
    const totalMeetings = directCount + subMeetingCount

    let msg = `Delete "${customer.name}"?`
    if (totalMeetings > 0) msg += ` ${totalMeetings} recurring meeting${totalMeetings !== 1 ? 's' : ''} will move to Misc Meetings.`
    if (subs.length > 0) msg += ` ${subs.length} sub-entit${subs.length !== 1 ? 'ies' : 'y'} will also be deleted.`

    if (!confirm(msg)) return

    // Move meetings to misc
    recurringMeetings
      .filter((m) => m.customerId === customer.id)
      .forEach((m) => saveRecurringMeeting({ ...m, customerId: '', customer: '' }))

    // Delete sub-entities and their meetings
    subs.forEach((sub) => {
      recurringMeetings
        .filter((m) => m.customerId === sub.id)
        .forEach((m) => saveRecurringMeeting({ ...m, customerId: '', customer: '' }))
      deleteCustomer(sub.id)
    })

    deleteCustomer(customer.id)
  }

  const startRename = (customer) => {
    setRenamingId(customer.id)
    setRenameVal(customer.name)
  }

  const commitRename = (customer) => {
    const name = renameVal.trim()
    if (name && name !== customer.name) {
      saveCustomer({ ...customer, name })
      // Update customer field on meetings linked by customerId
      recurringMeetings
        .filter((m) => m.customerId === customer.id)
        .forEach((m) => saveRecurringMeeting({ ...m, customer: name }))
    }
    setRenamingId(null)
  }

  const commitEmoji = (entity) => {
    saveCustomer({ ...entity, emoji: emojiVal })
    setEditingEmojiFor(null)
  }

  const startEditEmoji = (entity) => {
    setEmojiVal(entity.emoji || '')
    setEditingEmojiFor(entity.id)
  }

  const toggleEntityType = (entity) => {
    const newType = entity.type === 'customer' ? 'project' : 'customer'
    saveCustomer({ ...entity, type: newType })
  }

  const hasContent = recurringMeetings.length > 0 || customers.length > 0

  // Helper: render meetings grid for an entity
  const renderMeetingsGrid = (entityId, entityName) => {
    const meetings = sortAndFilter(meetingsByEntityId[entityId] || [])
    return (
      <>
        {meetings.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">No recurring meetings yet</p>
            <button
              className="btn-secondary text-sm flex items-center gap-1.5 mx-auto"
              onClick={() => {
                setEditingMeeting(null)
                setPrefilledCustomer(entityName)
                setPrefilledCustomerId(entityId)
                setView('editRecurring')
              }}
            >
              <Plus size={14} /> Add Recurring Meeting
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetings.map((mtg) => (
              <RecurringMeetingCard
                key={mtg.id}
                meeting={mtg}
                isToday={isScheduledToday(mtg.schedule)}
                noteCount={noteCountById[mtg.id] || 0}
                draftNotes={draftNotesByMeetingId[mtg.id] || []}
                showDrafts={filterDrafts}
                onEdit={() => { setEditingMeeting(mtg); setPrefilledCustomer(null); setPrefilledCustomerId(null); setView('editRecurring') }}
                onWriteNote={() => { setNoteConfig({ recurringMeetingId: mtg.id }); setView('newNote') }}
                onEditDraft={(draft) => { setNoteConfig({ existingNote: draft }); setView('newNote') }}
              />
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => { setNoteConfig({ prefilledCustomer: entityName }); setView('newNote') }}
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-accent transition-colors"
          >
            <FileEdit size={13} /> + {t('miscMeetings')}
          </button>
        </div>
      </>
    )
  }

  // Helper: entity header (shared for top-level and sub-entities)
  const renderEntityHeader = (entity, isSubEntity = false) => {
    const isOpen = openCustomers[entity.id]
    const typeBadge = isSubEntity
      ? (entity.type === 'project' ? 'Sub-Project' : 'Sub-Customer')
      : (entity.type === 'project' ? 'Project' : 'Customer')

    const directMeetingCount = (meetingsByEntityId[entity.id] || []).length
    const subsList = !isSubEntity ? (subEntitiesOf[entity.id] || []) : []
    const subMeetingCount = subsList.reduce((acc, sub) => acc + (meetingsByEntityId[sub.id] || []).length, 0)
    const totalCount = directMeetingCount + subMeetingCount

    return (
      <div className={`flex items-center gap-2 px-4 py-3 ${isSubEntity ? 'bg-gray-50/50 dark:bg-gray-800/30' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
        <button
          onClick={() => toggleCustomer(entity.id)}
          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
        >
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        {isOpen
          ? <FolderOpen size={16} className="text-accent shrink-0" />
          : <Folder size={16} className="text-accent shrink-0" />
        }

        {/* Type badge */}
        <button
          onClick={() => toggleEntityType(entity)}
          className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full border transition-colors bg-accent/10 border-accent/30 text-accent hover:bg-accent/20"
          title="Click to toggle type"
        >
          {typeBadge}
        </button>

        {/* Emoji */}
        {editingEmojiFor === entity.id ? (
          <input
            ref={emojiInputRef}
            className="input text-sm py-0.5 w-16 text-center shrink-0"
            value={emojiVal}
            onChange={(e) => setEmojiVal(e.target.value)}
            onBlur={() => commitEmoji(entity)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEmoji(entity)
              if (e.key === 'Escape') setEditingEmojiFor(null)
            }}
            placeholder="😀"
          />
        ) : (
          <button
            onClick={() => startEditEmoji(entity)}
            className="shrink-0 text-base leading-none hover:opacity-70 transition-opacity"
            title="Click to edit emoji"
          >
            {entity.emoji || <span className="text-gray-300 dark:text-gray-600 text-xs">+</span>}
          </button>
        )}

        {renamingId === entity.id ? (
          <>
            <input
              ref={renameInputRef}
              className="input text-sm py-0.5 flex-1 min-w-0"
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onBlur={() => commitRename(entity)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(entity)
                if (e.key === 'Escape') setRenamingId(null)
              }}
            />
            <button onClick={() => commitRename(entity)} className="p-1 text-green-500 hover:text-green-600 shrink-0">
              <Check size={13} />
            </button>
            <button onClick={() => setRenamingId(null)} className="p-1 text-gray-400 hover:text-gray-600 shrink-0">
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <button
              className="flex-1 text-left font-semibold text-gray-900 dark:text-white text-sm min-w-0 truncate"
              onClick={() => toggleCustomer(entity.id)}
            >
              {entity.name}
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
              {totalCount} meeting{totalCount !== 1 ? 's' : ''}
            </span>
            {!isSubEntity && (
              <button
                onClick={() => setMasterNotesCustomer(entity)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-accent hover:bg-accent-light dark:hover:bg-accent-light transition-colors shrink-0"
                title={t('masterNotes')}
              >
                <BookMarked size={13} /> {t('masterNotes')}
              </button>
            )}
            <button
              onClick={() => {
                setEditingMeeting(null)
                setPrefilledCustomer(entity.name)
                setPrefilledCustomerId(entity.id)
                setView('editRecurring')
              }}
              className="p-1.5 text-gray-400 hover:text-accent transition-colors shrink-0"
              title="New recurring meeting"
            >
              <Plus size={14} />
            </button>
            {!isSubEntity && (
              <button
                onClick={() => { setAddingSubOf(entity.id); setNewSubName('') }}
                className="p-1.5 text-gray-400 hover:text-purple-500 transition-colors shrink-0"
                title="Add sub-entity"
              >
                <span className="text-xs font-bold">⊕</span>
              </button>
            )}
            <button
              onClick={() => startRename(entity)}
              className="p-1.5 text-gray-400 hover:text-sky-500 transition-colors shrink-0"
              title="Rename"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => handleDeleteCustomer(entity)}
              className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors shrink-0"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meetings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {customers.length > 0
              ? `${customers.length} entit${customers.length !== 1 ? 'ies' : 'y'} · ${recurringMeetings.length} recurring meeting${recurringMeetings.length !== 1 ? 's' : ''}`
              : 'Manage recurring meetings and write new notes'
            }
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => { setNoteConfig({}); setView('newNote') }}
          >
            <FileEdit size={15} /> Write Note
          </button>
        </div>
      </div>

      {!hasContent ? (
        /* Empty state */
        <div className="card p-16 text-center">
          <Building2 size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No customers or meetings yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">
            Create customers or projects to organise your recurring meetings
          </p>
          <div className="flex gap-2 justify-center">
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => { setAddingCustomerType('customer'); setAddingCustomer(true) }}>
              <Plus size={14} /> New Customer
            </button>
            <button className="btn-secondary flex items-center gap-1.5" onClick={() => { setAddingCustomerType('project'); setAddingCustomer(true) }}>
              <Plus size={14} /> New Project
            </button>
            <button className="btn-primary flex items-center gap-1.5" onClick={() => { setNoteConfig({}); setView('newNote') }}>
              <FileEdit size={14} /> Write a Note Anyway
            </button>
          </div>
          {addingCustomer && (
            <div className="mt-4 flex gap-2 max-w-xs mx-auto">
              <input
                ref={newCustomerInputRef}
                className="input flex-1 text-sm"
                placeholder={addingCustomerType === 'project' ? 'Project name' : 'Customer name'}
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCustomer(addingCustomerType)
                  if (e.key === 'Escape') { setAddingCustomer(false); setNewCustomerName('') }
                }}
              />
              <button className="btn-primary text-sm" onClick={() => handleAddCustomer(addingCustomerType)}>Add</button>
              <button className="btn-ghost text-sm" onClick={() => { setAddingCustomer(false); setNewCustomerName('') }}>
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Search + filters */}
          <div className="mb-6 space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                className="input pl-8 text-sm w-full"
                placeholder="Search meetings…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown size={12} className="text-gray-400 shrink-0" />
                <select
                  className="input text-xs py-1 w-auto"
                  value={meetingSort}
                  onChange={(e) => setMeetingSort(e.target.value)}
                >
                  <option value="name_asc">Name A → Z</option>
                  <option value="name_desc">Name Z → A</option>
                  <option value="most_notes">Most notes</option>
                  <option value="recently_active">Recently active</option>
                  <option value="no_notes">No notes yet</option>
                </select>
              </div>
              <button
                onClick={() => setFilterHasNotes((v) => !v)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  filterHasNotes
                    ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400'
                    : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                Has notes
              </button>
              <button
                onClick={() => setFilterToday((v) => !v)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  filterToday
                    ? 'bg-accent/10 border-accent/40 text-accent'
                    : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                Today only
              </button>
              <button
                onClick={() => setFilterDrafts((v) => !v)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  filterDrafts
                    ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400'
                    : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                Drafts
              </button>
              {(filterHasNotes || filterToday || filterDrafts || search) && (
                <button
                  onClick={() => { setSearch(''); setFilterHasNotes(false); setFilterToday(false); setFilterDrafts(false) }}
                  className="text-xs text-accent hover:underline flex items-center gap-1 ml-auto"
                >
                  <X size={11} /> Clear
                </button>
              )}
            </div>

            {/* Type filter pills */}
            <div className="flex gap-1.5">
              {(['all', 'customer', 'project']).map((f) => (
                <button
                  key={f}
                  onClick={() => setTypeFilter(f)}
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors capitalize ${
                    typeFilter === f
                      ? 'bg-accent text-white border-accent'
                      : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-accent hover:text-accent'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'customer' ? 'Customers' : 'Projects'}
                </button>
              ))}
            </div>
          </div>

          {/* Today */}
          {todayMeetings.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-accent" />
                <h2 className="text-sm font-semibold text-accent uppercase tracking-wider">Today</h2>
                <span className="text-xs text-gray-400">
                  {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {todayMeetings.map((mtg) => (
                  <RecurringMeetingCard
                    key={mtg.id}
                    meeting={mtg}
                    isToday
                    noteCount={noteCountById[mtg.id] || 0}
                    draftNotes={draftNotesByMeetingId[mtg.id] || []}
                    showDrafts={filterDrafts}
                    onEdit={() => { setEditingMeeting(mtg); setPrefilledCustomer(null); setPrefilledCustomerId(null); setView('editRecurring') }}
                    onWriteNote={() => { setNoteConfig({ recurringMeetingId: mtg.id }); setView('newNote') }}
                    onEditDraft={(draft) => { setNoteConfig({ existingNote: draft }); setView('newNote') }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Entity accordions */}
          <div className="space-y-2">
            {topLevelEntities.map((entity) => {
              const subs = subEntitiesOf[entity.id] || []
              const isOpen = openCustomers[entity.id]
              return (
                <div key={entity.id} className="card overflow-hidden">
                  {renderEntityHeader(entity, false)}

                  {isOpen && (
                    <div className="p-4 space-y-4">
                      {/* Sub-entities */}
                      {subs.length > 0 && (
                        <div className="space-y-2">
                          {subs.map((sub) => (
                            <div key={sub.id} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ml-4 border-l-2 border-l-accent/30">
                              {renderEntityHeader(sub, true)}
                              {openCustomers[sub.id] && (
                                <div className="p-4">
                                  {renderMeetingsGrid(sub.id, sub.name)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add sub-entity inline form */}
                      {addingSubOf === entity.id && (
                        <div className="flex gap-2 items-center ml-4 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <input
                            ref={newSubInputRef}
                            className="input flex-1 text-sm"
                            placeholder={`New sub-${entity.type || 'customer'} name…`}
                            value={newSubName}
                            onChange={(e) => setNewSubName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddSub(entity.id)
                              if (e.key === 'Escape') { setAddingSubOf(null); setNewSubName('') }
                            }}
                          />
                          <button className="btn-primary text-sm py-1.5" onClick={() => handleAddSub(entity.id)}>Add</button>
                          <button
                            className="btn-ghost text-sm py-1.5"
                            onClick={() => { setAddingSubOf(null); setNewSubName('') }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Direct meetings */}
                      {renderMeetingsGrid(entity.id, entity.name)}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Misc Meetings */}
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                <button
                  onClick={() => toggleCustomer('__misc__')}
                  className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                >
                  {openCustomers['__misc__'] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                {openCustomers['__misc__']
                  ? <FolderOpen size={16} className="text-gray-400 shrink-0" />
                  : <Folder size={16} className="text-gray-400 shrink-0" />
                }
                <button
                  className="flex-1 text-left font-semibold text-gray-500 dark:text-gray-400 text-sm"
                  onClick={() => toggleCustomer('__misc__')}
                >
                  Misc Meetings
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {miscMeetings.length} meeting{miscMeetings.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => { setEditingMeeting(null); setPrefilledCustomer(null); setPrefilledCustomerId(null); setView('editRecurring') }}
                  className="p-1.5 text-gray-400 hover:text-accent transition-colors shrink-0"
                  title="New misc meeting"
                >
                  <Plus size={14} />
                </button>
              </div>

              {openCustomers['__misc__'] && (
                <div className="p-4">
                  {miscMeetings.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No misc meetings</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {miscMeetings.map((mtg) => (
                        <RecurringMeetingCard
                          key={mtg.id}
                          meeting={mtg}
                          isToday={isScheduledToday(mtg.schedule)}
                          noteCount={noteCountById[mtg.id] || 0}
                          draftNotes={draftNotesByMeetingId[mtg.id] || []}
                          showDrafts={filterDrafts}
                          onEdit={() => { setEditingMeeting(mtg); setPrefilledCustomer(null); setPrefilledCustomerId(null); setView('editRecurring') }}
                          onWriteNote={() => { setNoteConfig({ recurringMeetingId: mtg.id }); setView('newNote') }}
                          onEditDraft={(draft) => { setNoteConfig({ existingNote: draft }); setView('newNote') }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* No search results */}
          {search && filteredMeetings.length === 0 && (
            <div className="card p-10 text-center mt-2">
              <p className="text-gray-500 dark:text-gray-400 font-medium">No meetings match your search</p>
              <button className="text-sm text-accent mt-2 hover:underline" onClick={() => setSearch('')}>
                Clear search
              </button>
            </div>
          )}

          {/* Add customer / project */}
          <div className="mt-4">
            {addingCustomer ? (
              <div className="card p-3 flex gap-2 items-center">
                <Building2 size={15} className="text-gray-400 shrink-0" />
                <input
                  ref={newCustomerInputRef}
                  className="input flex-1 text-sm"
                  placeholder={addingCustomerType === 'project' ? 'New project name…' : 'New customer name…'}
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCustomer(addingCustomerType)
                    if (e.key === 'Escape') { setAddingCustomer(false); setNewCustomerName('') }
                  }}
                />
                <button className="btn-primary text-sm py-1.5" onClick={() => handleAddCustomer(addingCustomerType)}>Add</button>
                <button
                  className="btn-ghost text-sm py-1.5"
                  onClick={() => { setAddingCustomer(false); setNewCustomerName('') }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => { setAddingCustomerType('customer'); setAddingCustomer(true) }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-400 dark:text-gray-500 hover:border-accent hover:text-accent transition-colors"
                >
                  <Plus size={15} /> New Customer
                </button>
                <button
                  onClick={() => { setAddingCustomerType('project'); setAddingCustomer(true) }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-400 dark:text-gray-500 hover:border-accent hover:text-accent transition-colors"
                >
                  <Plus size={15} /> New Project
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {masterNotesCustomer && (
        <MasterNotesModal
          customer={masterNotesCustomer}
          customerNotes={notesByCustomer[masterNotesCustomer.name] || []}
          onClose={() => setMasterNotesCustomer(null)}
        />
      )}
    </div>
  )
}

function RecurringMeetingCard({ meeting, isToday, noteCount, draftNotes = [], showDrafts = false, onEdit, onWriteNote, onEditDraft }) {
  const enabledParticipants = (meeting.participants || []).filter((p) => p.enabled !== false)
  const label = scheduleLabel(meeting.schedule)
  const visibleDrafts = showDrafts ? draftNotes : draftNotes.slice(0, 3)

  return (
    <div className={`card p-4 hover:shadow-md transition-shadow ${isToday ? 'ring-2 ring-accent/40 ring-offset-1' : draftNotes.length > 0 ? 'ring-1 ring-amber-200 dark:ring-amber-800/50' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
              {meeting.name}
            </h3>
            {isToday && (
              <span className="text-xs bg-accent text-white px-2 py-0.5 rounded-full font-semibold shrink-0">
                Today
              </span>
            )}
          </div>
          {meeting.eventType && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{meeting.eventType}</p>
          )}
        </div>
        <button onClick={onEdit} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 shrink-0 ml-1">
          <ChevronRight size={16} />
        </button>
      </div>

      {meeting.team && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">Team: {meeting.team}</p>
      )}

      {label && (
        <p className="text-xs text-accent/80 font-medium mb-2">{label}</p>
      )}

      {noteCount > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
          {noteCount} saved note{noteCount !== 1 ? 's' : ''}
        </p>
      )}

      {enabledParticipants.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {enabledParticipants.slice(0, 4).map((p) => (
            <span
              key={p.id}
              className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full"
            >
              {p.name}
            </span>
          ))}
          {enabledParticipants.length > 4 && (
            <span className="text-xs text-gray-400 dark:text-gray-500 px-1 py-0.5">
              +{enabledParticipants.length - 4} more
            </span>
          )}
        </div>
      )}

      <button
        className="w-full btn-primary text-xs py-1.5 flex items-center justify-center gap-1.5"
        onClick={onWriteNote}
      >
        <FileEdit size={13} /> Write Note
      </button>

      {draftNotes.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
            <span className="text-xs">●</span> {draftNotes.length} draft{draftNotes.length !== 1 ? 's' : ''}
          </p>
          {visibleDrafts.map((draft) => (
            <div
              key={draft.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400 truncate block">
                  {draft.title || 'Untitled Draft'}
                </span>
                <span className="text-xs text-amber-600/70 dark:text-amber-500/70">{formatDate(draft.date)}</span>
              </div>
              <button
                onClick={() => onEditDraft(draft)}
                className="shrink-0 text-xs px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
              >
                Edit
              </button>
            </div>
          ))}
          {!showDrafts && draftNotes.length > 3 && (
            <p className="text-xs text-amber-500 dark:text-amber-500 text-center">+{draftNotes.length - 3} more (enable Drafts filter)</p>
          )}
        </div>
      )}
    </div>
  )
}
