import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  BookOpen, ChevronRight, ChevronDown, Calendar,
  Folder, FolderOpen, FileDown, Search, Copy, Pencil, Trash2,
  ArrowUpDown, FileEdit, X, Check, Brain, CheckSquare, Circle,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useApp } from '../../context/AppContext'
import { bulkExportToZip, exportSingleNote, formatDateForFilename, downloadBlob } from '../../utils/export'
import { buildContextAIPrompt } from '../../utils/aiPrompt'
import MeetingNoteEditor from '../meetings/MeetingNoteEditor'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function slug(str) {
  return str.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)
}

function noteTs(n) {
  return n.updatedAt || n.createdAt || (n.date ? n.date + 'T00:00:00.000Z' : '0000-00-00T00:00:00.000Z')
}

// exportGroups: [{ customerName, subgroups: [{ label, notes }] }]
// level: 'library' | 'customer' | 'meeting'
function BulkExportButton({ notes, exportGroups, zipFilename, templates, level }) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })
  const containerRef = useRef(null)
  const btnRef = useRef(null)
  const pngReady = notes.filter((n) => n.exportData).length

  // Close on outside click (scoped to document so overflow:hidden doesn't matter)
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen((v) => !v)
  }

  const run = async (e, format) => {
    e.stopPropagation()
    setOpen(false)
    if (busy) return
    setBusy(true)
    try {
      await bulkExportToZip(exportGroups, templates, format, zipFilename, level)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={containerRef} className="shrink-0">
      <button
        ref={btnRef}
        onClick={handleToggle}
        disabled={busy}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors text-accent hover:bg-accent-light dark:hover:bg-accent-light disabled:opacity-50"
        title="Export folder"
      >
        <FileDown size={12} />
        {busy ? 'Exporting…' : `Export (${notes.length})`}
      </button>

      {open && (
        <div
          style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 200 }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-44"
        >
          <div className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 mb-1">
            Download as ZIP
          </div>
          <button
            onClick={(e) => run(e, 'pdf')}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <FileDown size={11} className="text-accent" />
            PDF
          </button>
          <button
            onClick={(e) => run(e, 'docx')}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <FileDown size={11} className="text-blue-500" />
            Word (.docx)
          </button>
          <button
            onClick={(e) => run(e, 'png')}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <FileDown size={11} className="text-green-500" />
            Images (.jpg)
            {pngReady < notes.length && (
              <span className="text-gray-400 ml-auto">{pngReady}/{notes.length}</span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function AIContextButton({ notes, label, scope, iconSize = 12 }) {
  const [busy, setBusy] = useState(false)

  const handleClick = (e) => {
    e.stopPropagation()
    if (busy || !notes.length) return
    setBusy(true)
    try {
      const prompt = buildContextAIPrompt(notes, label, scope)
      const blob = new Blob([JSON.stringify(prompt, null, 2)], { type: 'application/json' })
      downloadBlob(blob, `ai_context_${slug(label)}_${new Date().toISOString().slice(0, 10)}.json`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy || !notes.length}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950 disabled:opacity-40"
      title="Export AI context prompt — feed to ChatGPT / Claude for a full summary"
    >
      <Brain size={iconSize} />
      AI Context
    </button>
  )
}

export default function LibraryPage() {
  const { meetingNotes, recurringMeetings, templates, saveMeetingNote, deleteMeetingNote } = useApp()
  const [editingNote, setEditingNote] = useState(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortDir, setSortDir] = useState('desc')
  const [openCustomers, setOpenCustomers] = useState({})
  const [openSubgroups, setOpenSubgroups] = useState({})

  // All hooks before any conditional return
  const rmMap = useMemo(() => {
    const m = {}
    recurringMeetings.forEach((r) => { m[r.id] = r })
    return m
  }, [recurringMeetings])

  const filteredNotes = useMemo(() => {
    let list = meetingNotes
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((n) =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.customer || '').toLowerCase().includes(q) ||
        (n.eventType || '').toLowerCase().includes(q) ||
        (n.team || '').toLowerCase().includes(q) ||
        (n.participants || []).some((p) => (p.name || '').toLowerCase().includes(q)) ||
        (n.sections || []).some((s) => {
          if (s.type === 'text' || s.type === 'notes') return (s.content || '').toLowerCase().includes(q)
          if (s.items) return (s.items || []).some((item) =>
            ['task', 'topic', 'description', 'decision', 'rationale', 'risk', 'mitigation', 'label', 'url', 'note', 'assignee', 'owner'].some(
              (k) => typeof item[k] === 'string' && item[k].toLowerCase().includes(q)
            )
          )
          return false
        })
      )
    }
    if (dateFrom) list = list.filter((n) => (n.date || '') >= dateFrom)
    if (dateTo)   list = list.filter((n) => (n.date || '') <= dateTo)
    return list
  }, [meetingNotes, search, dateFrom, dateTo])

  // Build 2-level hierarchy: Customer > (RecurringMeeting | One-off Notes)
  const libraryGroups = useMemo(() => {
    const customerMap = {}

    const sortFn = (a, b) =>
      sortDir === 'desc'
        ? noteTs(b).localeCompare(noteTs(a))
        : noteTs(a).localeCompare(noteTs(b))

    filteredNotes.forEach((n) => {
      let customerName, subgroupKey, subgroupLabel, subgroupSubtitle

      if (n.recurringMeetingId && rmMap[n.recurringMeetingId]) {
        const rm = rmMap[n.recurringMeetingId]
        customerName = rm.customer || 'Uncategorised'
        subgroupKey = `rm::${n.recurringMeetingId}`
        subgroupLabel = rm.name
        subgroupSubtitle = rm.eventType || ''
      } else {
        customerName = n.customer || 'Uncategorised'
        subgroupKey = `oneoff::${customerName}`
        subgroupLabel = 'One-off Notes'
        subgroupSubtitle = ''
      }

      if (!customerMap[customerName]) customerMap[customerName] = { subgroups: {} }
      if (!customerMap[customerName].subgroups[subgroupKey]) {
        customerMap[customerName].subgroups[subgroupKey] = {
          key: subgroupKey, label: subgroupLabel, subtitle: subgroupSubtitle, notes: [],
        }
      }
      customerMap[customerName].subgroups[subgroupKey].notes.push(n)
    })

    return Object.entries(customerMap)
      .map(([customerName, { subgroups }]) => ({
        customerName,
        subgroups: Object.values(subgroups)
          .map((sg) => ({ ...sg, notes: sg.notes.slice().sort(sortFn) }))
          .sort((a, b) => {
            if (a.label === 'One-off Notes' && b.label !== 'One-off Notes') return 1
            if (b.label === 'One-off Notes' && a.label !== 'One-off Notes') return -1
            return a.label.localeCompare(b.label)
          }),
      }))
      .sort((a, b) => {
        if (a.customerName === 'Uncategorised') return 1
        if (b.customerName === 'Uncategorised') return -1
        return a.customerName.localeCompare(b.customerName)
      })
  }, [filteredNotes, rmMap, sortDir])

  const hasFilters = search || dateFrom || dateTo
  const clearFilters = () => { setSearch(''); setDateFrom(''); setDateTo('') }

  const toggleCustomer = (name) => setOpenCustomers((s) => ({ ...s, [name]: !s[name] }))
  const toggleSubgroup = (key) => setOpenSubgroups((s) => ({ ...s, [key]: !s[key] }))

  if (editingNote) {
    return (
      <MeetingNoteEditor
        existingNote={editingNote}
        onClose={() => setEditingNote(null)}
      />
    )
  }

  if (meetingNotes.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Library</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">All your saved meeting notes</p>
        </div>
        <div className="card p-16 text-center">
          <BookOpen size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No notes saved yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Write and save meeting notes — they'll appear here organised by customer
          </p>
        </div>
      </div>
    )
  }

  const totalNotes = filteredNotes.length

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Library</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {totalNotes}{hasFilters ? ` of ${meetingNotes.length}` : ''} note{meetingNotes.length !== 1 ? 's' : ''}
            {' '}across {libraryGroups.length} customer{libraryGroups.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <AIContextButton notes={filteredNotes} label="Full Library" scope="library" />
          <BulkExportButton
            notes={filteredNotes}
            exportGroups={libraryGroups}
            zipFilename={`notes_library_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.zip`}
            templates={templates}
            level="library"
          />
        </div>
      </div>

      {/* Filter bar */}
      <div className="card p-3 mb-4 space-y-2">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="input pl-8 text-sm w-full"
              placeholder="Search title, customer, content, participant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
            className="input text-sm flex items-center gap-1.5 w-auto px-3 text-gray-600 dark:text-gray-300 hover:border-accent transition-colors"
            title="Toggle sort order"
          >
            <ArrowUpDown size={13} className="text-gray-400" />
            {sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
          </button>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-gray-400 shrink-0">Date range:</span>
          <input
            type="date"
            className="input text-sm w-40"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-xs text-gray-400">—</span>
          <input
            type="date"
            className="input text-sm w-40"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-accent hover:underline flex items-center gap-1">
              <X size={11} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* 2-level accordion */}
      {libraryGroups.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-gray-500 dark:text-gray-400 font-medium">No notes match your filters</p>
          <button className="text-sm text-accent mt-2 hover:underline" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : (
        <div className="space-y-2">
          {libraryGroups.map((group) => {
            const isCustomerOpen = openCustomers[group.customerName]
            const groupNotes = group.subgroups.flatMap((sg) => sg.notes)

            return (
              <div key={group.customerName} className="card overflow-hidden">
                {/* Customer-level header */}
                <div className="flex items-center">
                  <button
                    onClick={() => toggleCustomer(group.customerName)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors text-left min-w-0"
                  >
                    {isCustomerOpen
                      ? <FolderOpen size={18} className="text-accent shrink-0" />
                      : <Folder size={18} className="text-accent shrink-0" />
                    }
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{group.customerName}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                        {group.subgroups.length} folder{group.subgroups.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 mr-2 shrink-0">
                      {groupNotes.length} note{groupNotes.length !== 1 ? 's' : ''}
                    </span>
                    {isCustomerOpen
                      ? <ChevronDown size={16} className="text-gray-400 shrink-0" />
                      : <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    }
                  </button>
                  <div className="pr-3 flex items-center gap-1">
                    <AIContextButton notes={groupNotes} label={group.customerName} scope="customer" />
                    <BulkExportButton
                      notes={groupNotes}
                      exportGroups={[group]}
                      zipFilename={`${slug(group.customerName)}_notes.zip`}
                      templates={templates}
                      level="customer"
                    />
                  </div>
                </div>

                {/* Subgroups */}
                {isCustomerOpen && (
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    {group.subgroups.map((sg, idx) => {
                      const isSubOpen = openSubgroups[sg.key]
                      const isLast = idx === group.subgroups.length - 1

                      return (
                        <div
                          key={sg.key}
                          className={!isLast ? 'border-b border-gray-100 dark:border-gray-700' : ''}
                        >
                          {/* Subgroup header */}
                          <div className="flex items-center bg-gray-50/50 dark:bg-gray-900/20">
                            <button
                              onClick={() => toggleSubgroup(sg.key)}
                              className="flex-1 flex items-center gap-3 pl-8 pr-3 py-2.5 hover:bg-gray-100/50 dark:hover:bg-gray-800/20 transition-colors text-left min-w-0"
                            >
                              {isSubOpen
                                ? <FolderOpen size={15} className="text-gray-400 shrink-0" />
                                : <Folder size={15} className="text-gray-400 shrink-0" />
                              }
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                {sg.label}
                              </span>
                              {sg.subtitle && (
                                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{sg.subtitle}</span>
                              )}
                              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto shrink-0">
                                {sg.notes.length} note{sg.notes.length !== 1 ? 's' : ''}
                              </span>
                              {isSubOpen
                                ? <ChevronDown size={14} className="text-gray-400 shrink-0 ml-1" />
                                : <ChevronRight size={14} className="text-gray-400 shrink-0 ml-1" />
                              }
                            </button>
                            <div className="pr-3 flex items-center gap-1">
                              <AIContextButton notes={sg.notes} label={sg.label} scope="recurring_meeting" />
                              <BulkExportButton
                                notes={sg.notes}
                                exportGroups={[{ customerName: group.customerName, subgroups: [sg] }]}
                                zipFilename={`${slug(group.customerName)}_${slug(sg.label)}.zip`}
                                templates={templates}
                                level="meeting"
                              />
                            </div>
                          </div>

                          {/* Notes list */}
                          {isSubOpen && (
                            <div className="pl-8 pr-4 py-2 space-y-1 bg-white dark:bg-gray-900/10">
                              {sg.notes.map((note) => (
                                <NoteRow
                                  key={note.id}
                                  note={note}
                                  onEdit={() => setEditingNote(note)}
                                  onDelete={() => {
                                    if (confirm(`Delete "${note.title}"? This cannot be undone.`)) {
                                      deleteMeetingNote(note.id)
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NoteExportDropdown({ note }) {
  const { templates } = useApp()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })
  const containerRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen((v) => !v)
  }

  const run = async (e, format) => {
    e.stopPropagation()
    setOpen(false)
    if (busy) return
    setBusy(true)
    try {
      const template = (templates || []).find((t) => t.id === note.templateId) || null
      const base = `${formatDateForFilename(note.date)}_${slug(note.title || 'note')}`
      const ext = format === 'pdf' ? '.pdf' : format === 'docx' ? '.docx' : '.jpg'
      await exportSingleNote(note, template, format, base + ext)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={containerRef}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        disabled={busy}
        className="p-1.5 rounded text-gray-400 hover:text-accent hover:bg-accent-light dark:hover:bg-accent-light transition-colors disabled:opacity-50"
        title="Export note"
      >
        <FileDown size={13} />
      </button>

      {open && (
        <div
          style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 200 }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-36"
        >
          <button onClick={(e) => run(e, 'pdf')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
            <FileDown size={11} className="text-accent" /> PDF
          </button>
          <button onClick={(e) => run(e, 'docx')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
            <FileDown size={11} className="text-blue-500" /> Word (.docx)
          </button>
          <button onClick={(e) => run(e, 'png')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
            <FileDown size={11} className="text-green-500" /> Image (.jpg)
          </button>
        </div>
      )}
    </div>
  )
}

function NoteRow({ note, onEdit, onDelete }) {
  const { saveMeetingNote } = useApp()
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState('')
  const [actionsOpen, setActionsOpen] = useState(false)
  const renameRef = useRef(null)

  useEffect(() => {
    if (renaming && renameRef.current) renameRef.current.select()
  }, [renaming])

  const participants = (note.participants || []).filter((p) => p.enabled !== false && p.name)

  const allActionItems = (note.sections || [])
    .filter((s) => s.type === 'actionItems')
    .flatMap((s) => s.items || [])
    .filter((i) => i.task)
  const pendingCount = allActionItems.filter((i) => i.status !== 'done').length

  const cycleActionStatus = (sectionId, itemId) => {
    const cycle = { todo: 'inProgress', inProgress: 'done', done: 'todo' }
    const updated = {
      ...note,
      sections: (note.sections || []).map((s) =>
        s.id !== sectionId ? s : {
          ...s,
          items: (s.items || []).map((i) =>
            i.id !== itemId ? i : { ...i, status: cycle[i.status || 'todo'] || 'inProgress' }
          ),
        }
      ),
      updatedAt: new Date().toISOString(),
    }
    saveMeetingNote(updated)
  }

  const startRename = (e) => {
    e.stopPropagation()
    setRenameVal(note.title)
    setRenaming(true)
  }

  const commitRename = () => {
    const trimmed = renameVal.trim()
    if (trimmed && trimmed !== note.title) {
      saveMeetingNote({ ...note, title: trimmed, updatedAt: new Date().toISOString() })
    }
    setRenaming(false)
  }

  const handleRenameKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename() }
    if (e.key === 'Escape') setRenaming(false)
  }

  const handleDuplicate = () => {
    saveMeetingNote({
      ...note,
      id: uuid(),
      title: `Copy of ${note.title}`,
      date: new Date().toISOString().slice(0, 10),
      exportData: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  const STATUS_COLORS = { todo: 'text-gray-400', inProgress: 'text-amber-500', done: 'text-green-500' }

  return (
    <div>
      <div className="flex items-center gap-2 py-2 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
        <Calendar size={13} className="text-gray-400 shrink-0 mt-0.5" />

        <span className="text-xs text-gray-400 shrink-0 w-24">{formatDate(note.date)}</span>

        <div className="flex-1 min-w-0">
          {renaming ? (
            <div className="flex items-center gap-1">
              <input
                ref={renameRef}
                className="input text-sm py-0.5 flex-1"
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleRenameKey}
              />
              <button onClick={commitRename} className="p-1 text-green-500 hover:text-green-600">
                <Check size={13} />
              </button>
              <button onClick={() => setRenaming(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">{note.title}</span>
                {participants.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {participants.slice(0, 3).map((p) => p.name).join(', ')}
                    {participants.length > 3 ? ` +${participants.length - 3}` : ''}
                  </span>
                )}
              </div>
              {pendingCount > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setActionsOpen((v) => !v) }}
                  className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                    actionsOpen
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-amber-50 dark:hover:bg-amber-950 hover:text-amber-600'
                  }`}
                  title="Toggle action items"
                >
                  <CheckSquare size={10} />
                  {pendingCount}
                </button>
              )}
            </div>
          )}
        </div>

        {!renaming && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded text-gray-400 hover:text-accent hover:bg-accent-light dark:hover:bg-accent-light transition-colors"
              title="Edit note"
            >
              <FileEdit size={13} />
            </button>
            <button
              onClick={startRename}
              className="p-1.5 rounded text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950 transition-colors"
              title="Rename"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={handleDuplicate}
              className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Duplicate"
            >
              <Copy size={13} />
            </button>
            <AIContextButton notes={[note]} label={note.title || 'Meeting'} scope="single_meeting" iconSize={13} />
            <NoteExportDropdown note={note} />
            <button
              onClick={onDelete}
              className="p-1.5 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              title="Delete note"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Action items quick-edit panel */}
      {actionsOpen && allActionItems.length > 0 && (
        <div className="ml-8 mb-1 mr-1 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          {(note.sections || [])
            .filter((s) => s.type === 'actionItems')
            .map((s) => (s.items || []).filter((i) => i.task).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-50 dark:border-gray-800 last:border-0"
              >
                <button
                  onClick={() => cycleActionStatus(s.id, item.id)}
                  className={`shrink-0 transition-colors ${STATUS_COLORS[item.status || 'todo']}`}
                  title={`Status: ${item.status || 'todo'} — click to advance`}
                >
                  {item.status === 'done'
                    ? <CheckSquare size={13} />
                    : <Circle size={13} />
                  }
                </button>
                <span className={`flex-1 text-xs ${item.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {item.task}
                </span>
                {item.assignee && (
                  <span className="text-xs text-gray-400 shrink-0">{item.assignee}</span>
                )}
                <span className={`text-xs shrink-0 font-medium ${
                  item.status === 'done' ? 'text-green-500' :
                  item.status === 'inProgress' ? 'text-amber-500' : 'text-gray-400'
                }`}>
                  {item.status === 'inProgress' ? 'In Progress' : item.status === 'done' ? 'Done' : 'To do'}
                </span>
              </div>
            )))
          }
        </div>
      )}
    </div>
  )
}
