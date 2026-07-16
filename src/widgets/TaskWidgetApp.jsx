import React, { useEffect, useMemo, useState } from 'react'
import { CheckSquare, X, FileText } from 'lucide-react'
import { useRemoteAppState } from './useRemoteAppState'
import { buildAllTasks, currentWorkWeekRange, buildCustomerTypeMap, taskCategory } from '../utils/taskUtils'

const DUE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'all', label: 'All' },
]

const CATEGORY_FILTERS = [
  { key: '', label: 'All' },
  { key: 'customer', label: 'Customers' },
  { key: 'project', label: 'Projects' },
]

function formatDue(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function TaskWidgetApp() {
  const remoteState = useRemoteAppState()
  const [dueFilter, setDueFilter] = useState('today')
  const [customerFilter, setCustomerFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('') // '' | 'customer' | 'project'
  const [showComplete, setShowComplete] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const { start, end } = currentWorkWeekRange()

  const allTasks = useMemo(() => {
    if (!remoteState) return []
    return buildAllTasks(remoteState.meetingNotes, remoteState.standaloneTasks, !!remoteState.settings?.internalNotesEnabled)
  }, [remoteState])

  const custTypeMap = useMemo(() => buildCustomerTypeMap(remoteState?.customers), [remoteState])

  const customers = useMemo(() =>
    [...new Set(allTasks.map((t) => t.customer).filter(Boolean))].sort(), [allTasks])
  const customersInCategory = useMemo(() => {
    if (!categoryFilter) return customers
    return customers.filter((c) => custTypeMap[c.toLowerCase()] === categoryFilter)
  }, [customers, custTypeMap, categoryFilter])

  const visible = useMemo(() => {
    return allTasks
      .filter((t) => showComplete || t.status !== 'complete')
      .filter((t) => !customerFilter || t.customer === customerFilter)
      .filter((t) => !categoryFilter || taskCategory(t, custTypeMap) === categoryFilter)
      .filter((t) => {
        if (dueFilter === 'all') return true
        if (!t.endDate) return false
        if (dueFilter === 'today') return t.endDate === today
        return t.endDate >= start && t.endDate <= end
      })
      .sort((a, b) => (a.endDate || '9999-99-99').localeCompare(b.endDate || '9999-99-99'))
  }, [allTasks, dueFilter, customerFilter, categoryFilter, custTypeMap, showComplete, today, start, end])

  // If the customer filter no longer belongs to the selected category, clear it
  // rather than silently showing zero results.
  useEffect(() => {
    if (customerFilter && !customersInCategory.includes(customerFilter)) setCustomerFilter('')
  }, [categoryFilter, customersInCategory, customerFilter])

  const toggleComplete = (task) => {
    window.electronAPI?.sendWidgetTaskAction?.({
      type: 'setStatus',
      task,
      status: task.status === 'complete' ? 'planned' : 'complete',
    })
  }

  const close = () => window.electronAPI?.closeCurrentWindow?.()
  const openPreview = (noteId) => window.electronAPI?.openNotePreview?.(noteId, {
    darkMode: remoteState?.darkMode,
    accentLight: remoteState?.settings?.accentLight,
    accentDark: remoteState?.settings?.accentDark,
  })

  if (!remoteState) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-gray-400 dark:text-gray-500 bg-gradient-to-br from-gray-50 via-accent-light/80 to-accent-muted/25 dark:from-black dark:via-gray-950 dark:to-black">
        Loading…
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col text-gray-900 dark:text-white overflow-hidden relative isolate bg-gradient-to-br from-gray-50 via-accent-light/80 to-accent-muted/25 dark:from-black dark:via-gray-950 dark:to-black">
      {/* Ambient blobs — same recipe as the main app's background */}
      <div className="pointer-events-none fixed -z-10 inset-0 overflow-hidden">
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-accent/40 dark:bg-accent/12 blur-3xl" />
        <div className="absolute -bottom-20 -right-16 w-72 h-72 rounded-full bg-accent-muted/35 dark:bg-accent-muted/10 blur-3xl" />
      </div>

      {/* Drag header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 glass-pill border-b border-white/60 dark:border-white/10 shrink-0 select-none"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <CheckSquare size={15} className="text-green-500 shrink-0" />
        <span className="text-sm font-semibold flex-1">Tasks</span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{visible.length}</span>
        <button
          onClick={close}
          className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' }}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-white/50 dark:border-white/5 space-y-1.5 shrink-0">
        <div className="flex rounded-lg glass-pill overflow-hidden text-[11px]">
          {DUE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setDueFilter(f.key)}
              className={`flex-1 py-1 font-medium transition-colors ${
                dueFilter === f.key
                  ? 'bg-accent text-[color:var(--accent-contrast)]'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {customers.length > 0 && (
          <>
            <div className="flex rounded-lg glass-pill overflow-hidden text-[11px]">
              {CATEGORY_FILTERS.map((f) => (
                <button
                  key={f.key || 'all'}
                  onClick={() => setCategoryFilter(f.key)}
                  className={`flex-1 py-1 font-medium transition-colors ${
                    categoryFilter === f.key
                      ? 'bg-accent text-[color:var(--accent-contrast)]'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select
              className="input text-[11px] py-1 w-full"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="">{categoryFilter === 'project' ? 'All projects' : categoryFilter === 'customer' ? 'All customers' : 'All customers/projects'}</option>
              {customersInCategory.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {visible.length === 0 ? (
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-6">No tasks match.</p>
        ) : (
          visible.map((task) => {
            const overdue = task.endDate && task.endDate < today && task.status !== 'complete'
            const isComplete = task.status === 'complete'
            return (
              <div
                key={task.isStandalone ? `s-${task.id}` : `${task.noteId}-${task.id}`}
                className="rounded-lg card px-2.5 py-2"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={isComplete}
                    onChange={() => toggleComplete(task)}
                    className="mt-0.5 rounded text-accent shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-snug ${isComplete ? 'line-through text-gray-500 dark:text-gray-400' : ''}`}>
                      {task.text}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {task.endDate && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            overdue
                              ? 'bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400'
                              : 'bg-white/50 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {formatDue(task.endDate)}
                        </span>
                      )}
                      {task.customer && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[80px]">{task.customer}</span>
                      )}
                      {task.assignee && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{task.assignee}</span>
                      )}
                      {!task.isStandalone && (
                        <button
                          onClick={() => openPreview(task.noteId)}
                          className="flex items-center gap-0.5 text-[10px] text-accent hover:underline ml-auto"
                          title="Preview meeting note"
                        >
                          <FileText size={10} /> <span className="truncate max-w-[90px]">{task.noteTitle}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer toggle */}
      <div className="px-3 py-1.5 border-t border-white/50 dark:border-white/5 shrink-0">
        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={showComplete}
            onChange={(e) => setShowComplete(e.target.checked)}
            className="rounded text-accent"
          />
          Show completed
        </label>
      </div>
    </div>
  )
}
