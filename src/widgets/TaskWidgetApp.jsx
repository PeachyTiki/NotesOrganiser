import React, { useMemo, useState } from 'react'
import { CheckSquare, X, FileText } from 'lucide-react'
import { useRemoteAppState } from './useRemoteAppState'
import { buildAllTasks, currentWorkWeekRange } from '../utils/taskUtils'

const DUE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'all', label: 'All' },
]

function formatDue(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function TaskWidgetApp() {
  const remoteState = useRemoteAppState()
  const [dueFilter, setDueFilter] = useState('today')
  const [customerFilter, setCustomerFilter] = useState('')
  const [showComplete, setShowComplete] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const { start, end } = currentWorkWeekRange()

  const allTasks = useMemo(() => {
    if (!remoteState) return []
    return buildAllTasks(remoteState.meetingNotes, remoteState.standaloneTasks, !!remoteState.settings?.internalNotesEnabled)
  }, [remoteState])

  const customers = useMemo(() =>
    [...new Set(allTasks.map((t) => t.customer).filter(Boolean))].sort(), [allTasks])

  const visible = useMemo(() => {
    return allTasks
      .filter((t) => showComplete || t.status !== 'complete')
      .filter((t) => !customerFilter || t.customer === customerFilter)
      .filter((t) => {
        if (dueFilter === 'all') return true
        if (!t.endDate) return false
        if (dueFilter === 'today') return t.endDate === today
        return t.endDate >= start && t.endDate <= end
      })
      .sort((a, b) => (a.endDate || '9999-99-99').localeCompare(b.endDate || '9999-99-99'))
  }, [allTasks, dueFilter, customerFilter, showComplete, today, start, end])

  const toggleComplete = (task) => {
    window.electronAPI?.sendWidgetTaskAction?.({
      type: 'setStatus',
      task,
      status: task.status === 'complete' ? 'planned' : 'complete',
    })
  }

  const close = () => window.electronAPI?.closeCurrentWindow?.()
  const openPreview = (noteId) => window.electronAPI?.openNotePreview?.(noteId)

  if (!remoteState) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-gray-400 bg-white dark:bg-gray-900">
        Loading…
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden">
      {/* Drag header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0 select-none"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <CheckSquare size={15} className="text-green-500 shrink-0" />
        <span className="text-sm font-semibold flex-1">Tasks</span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{visible.length}</span>
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
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 space-y-1.5 shrink-0">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-[11px]">
          {DUE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setDueFilter(f.key)}
              className={`flex-1 py-1 font-medium transition-colors ${
                dueFilter === f.key
                  ? 'bg-accent text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {customers.length > 0 && (
          <select
            className="input text-[11px] py-1 w-full"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            <option value="">All customers</option>
            {customers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {visible.length === 0 ? (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-6">No tasks match.</p>
        ) : (
          visible.map((task) => {
            const overdue = task.endDate && task.endDate < today && task.status !== 'complete'
            const isComplete = task.status === 'complete'
            return (
              <div
                key={task.isStandalone ? `s-${task.id}` : `${task.noteId}-${task.id}`}
                className="rounded-lg border border-gray-100 dark:border-gray-800 px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={isComplete}
                    onChange={() => toggleComplete(task)}
                    className="mt-0.5 rounded text-accent shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-snug ${isComplete ? 'line-through text-gray-400' : ''}`}>
                      {task.text}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {task.endDate && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            overdue
                              ? 'bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {formatDue(task.endDate)}
                        </span>
                      )}
                      {task.assignee && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">{task.assignee}</span>
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
      <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 shrink-0">
        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-500 dark:text-gray-400">
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
