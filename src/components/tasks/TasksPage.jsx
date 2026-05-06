import React, { useState, useMemo } from 'react'
import { CheckSquare, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '../../context/AppContext'

const STATUS_STYLES = {
  planned:    { badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300', label: 'Planned' },
  inProgress: { badge: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300', label: 'In Progress' },
  complete:   { badge: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300', label: 'Complete' },
  blocked:    { badge: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300', label: 'Blocked' },
}

const STATUS_ORDER = ['planned', 'inProgress', 'blocked', 'complete']

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TasksPage() {
  const { meetingNotes, settings, saveMeetingNote, triggerNoteSync } = useApp()
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterMeeting, setFilterMeeting] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [showComplete, setShowComplete] = useState(false)
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const [sortBy, setSortBy] = useState('date') // date | alpha | status
  const [sortAsc, setSortAsc] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  const internalEnabled = !!settings?.internalNotesEnabled

  // Collect all tasks from all notes
  const allTasks = useMemo(() => {
    const result = []
    for (const note of meetingNotes) {
      if (note.isDraft) continue
      const extractFromSections = (sections, isInternal) => {
        for (const section of sections || []) {
          if (section.type !== 'tasks') continue
          for (const item of section.items || []) {
            if (!item.text) continue
            result.push({
              ...item,
              noteId: note.id,
              sectionId: section.id,
              isInternal,
              customer: note.customer || '',
              recurringMeetingId: note.recurringMeetingId || '',
              noteDate: note.date || '',
              noteTitle: note.title || note.customer || 'Untitled',
            })
          }
        }
      }
      extractFromSections(note.sections, false)
      if (internalEnabled) extractFromSections(note.internalSections, true)
    }
    return result
  }, [meetingNotes, internalEnabled])

  // Unique filter options
  const customers = useMemo(() =>
    [...new Set(allTasks.map((t) => t.customer).filter(Boolean))].sort(), [allTasks])
  const meetings = useMemo(() =>
    [...new Set(allTasks.map((t) => t.recurringMeetingId).filter(Boolean))], [allTasks])
  const assignees = useMemo(() =>
    [...new Set(allTasks.map((t) => t.assignee).filter(Boolean))].sort(), [allTasks])

  const meetingNoteById = useMemo(() => {
    const m = {}
    for (const n of meetingNotes) m[n.id] = n
    return m
  }, [meetingNotes])

  // Filter and sort
  const overdueCount = useMemo(() =>
    allTasks.filter((t) => t.endDate && t.endDate < today && t.status !== 'complete').length,
  [allTasks, today])

  const visible = useMemo(() => {
    let list = allTasks.filter((t) => {
      if (!showComplete && t.status === 'complete') return false
      if (filterCustomer && t.customer !== filterCustomer) return false
      if (filterMeeting && t.recurringMeetingId !== filterMeeting) return false
      if (filterAssignee && t.assignee !== filterAssignee) return false
      if (showOverdueOnly && !(t.endDate && t.endDate < today && t.status !== 'complete')) return false
      return true
    })
    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'date') cmp = (a.createdAt || '').localeCompare(b.createdAt || '')
      else if (sortBy === 'alpha') cmp = (a.text || '').localeCompare(b.text || '')
      else if (sortBy === 'status') cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [allTasks, showComplete, filterCustomer, filterMeeting, filterAssignee, sortBy, sortAsc])

  const handleStatusChange = (task, newStatus) => {
    const note = meetingNoteById[task.noteId]
    if (!note) return

    const updateSections = (sections) =>
      (sections || []).map((s) => {
        if (s.id !== task.sectionId) return s
        return {
          ...s,
          items: (s.items || []).map((i) =>
            i.id === task.id ? { ...i, status: newStatus } : i
          ),
        }
      })

    const updated = {
      ...note,
      sections: updateSections(note.sections),
      internalSections: updateSections(note.internalSections),
      updatedAt: new Date().toISOString(),
    }
    saveMeetingNote(updated)
    triggerNoteSync(updated)
  }

  const toggleSort = (col) => {
    if (sortBy === col) setSortAsc((v) => !v)
    else { setSortBy(col); setSortAsc(false) }
  }

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return null
    return sortAsc ? <ChevronUp size={11} className="inline ml-0.5" /> : <ChevronDown size={11} className="inline ml-0.5" />
  }

  const totalCount = allTasks.length
  const doneCount = allTasks.filter((t) => t.status === 'complete').length
  const openCount = totalCount - doneCount
  const isOverdue = (t) => t.endDate && t.endDate < today && t.status !== 'complete'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <CheckSquare size={20} className="text-green-500 shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tasks</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {openCount} open · {doneCount} complete · {totalCount} total
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Filter size={13} className="text-accent shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Filters</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Customer</label>
            <select className="input text-xs py-1 min-w-[120px]" value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}>
              <option value="">All</option>
              {customers.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Assignee</label>
            <select className="input text-xs py-1 min-w-[120px]" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
              <option value="">All</option>
              {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Sort</label>
            <select className="input text-xs py-1" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date">Date created</option>
              <option value="alpha">Alphabetical</option>
              <option value="status">Status</option>
            </select>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showComplete}
              onChange={(e) => setShowComplete(e.target.checked)}
              className="rounded text-accent"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">Show completed</span>
          </label>
          <button
            onClick={() => setShowOverdueOnly((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
              showOverdueOnly
                ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-red-300 hover:text-red-500'
            }`}
          >
            Overdue
            {overdueCount > 0 && (
              <span className="min-w-[17px] h-[17px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                {overdueCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tasks table */}
      {visible.length === 0 ? (
        <div className="card p-10 text-center">
          <CheckSquare size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {allTasks.length === 0
              ? 'No tasks yet. Add tasks inside any meeting note to see them here.'
              : 'No tasks match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th
                  className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  onClick={() => toggleSort('alpha')}
                >
                  Task <SortIcon col="alpha" />
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Assignee</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Dates</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Meeting</th>
                {internalEnabled && (
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</th>
                )}
                <th
                  className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  onClick={() => toggleSort('status')}
                >
                  Status <SortIcon col="status" />
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => {
                const st = STATUS_STYLES[task.status] || STATUS_STYLES.planned
                const isComplete = task.status === 'complete'
                return (
                  <tr
                    key={`${task.noteId}-${task.sectionId}-${task.id}`}
                    className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={`font-medium ${isComplete ? 'text-green-600 dark:text-green-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {task.text}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400 text-xs">{task.assignee || '—'}</td>
                    <td className={`px-3 py-3 text-xs whitespace-nowrap ${isOverdue(task) ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-500'}`}>
                      {task.startDate || task.endDate
                        ? `${[formatDate(task.startDate), formatDate(task.endDate)].filter(Boolean).join(' → ')}${isOverdue(task) ? ' ⚠' : ''}`
                        : '—'}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-[160px]">{task.noteTitle}</div>
                      {task.customer && (
                        <div className="text-gray-400 dark:text-gray-500 truncate max-w-[160px]">{task.customer}</div>
                      )}
                      <div className="text-gray-400 dark:text-gray-500">{formatDate(task.noteDate)}</div>
                    </td>
                    {internalEnabled && (
                      <td className="px-3 py-3">
                        {task.isInternal ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-medium">Internal</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 font-medium">Standard</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <select
                        className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border-0 cursor-pointer ${st.badge}`}
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value)}
                      >
                        <option value="planned">Planned</option>
                        <option value="inProgress">In Progress</option>
                        <option value="complete">Complete</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
