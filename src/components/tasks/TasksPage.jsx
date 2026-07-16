import React, { useState, useMemo, useRef } from 'react'
import { CheckSquare, Filter, ChevronDown, ChevronUp, Plus, Brain, Download, Clipboard, Trash2, Pencil, FileText, X, PictureInPicture2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useApp } from '../../context/AppContext'
import { buildStandaloneTasksAIPrompt } from '../../utils/aiPrompt'
import { downloadBlob } from '../../utils/export'
import { buildAllTasks } from '../../utils/taskUtils'

const STATUS_STYLES = {
  planned:    { badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300', label: 'Planned' },
  inProgress: { badge: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300', label: 'In Progress' },
  complete:   { badge: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300', label: 'Complete' },
  blocked:    { badge: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300', label: 'Blocked' },
}

const STATUS_ORDER = ['planned', 'inProgress', 'blocked', 'complete']

const EMPTY_FORM = { text: '', assignee: '', startDate: '', endDate: '', status: 'planned' }

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// createdAt is a full ISO timestamp (not a plain date), unlike startDate/endDate.
function formatCreated(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TasksPage() {
  const {
    meetingNotes, standaloneTasks, settings,
    saveStandaloneTask, deleteStandaloneTask, setTaskStatus,
    update,
  } = useApp()

  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [showComplete, setShowComplete] = useState(false)
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const [sortBy, setSortBy] = useState('date')
  const [sortAsc, setSortAsc] = useState(false)

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [addTab, setAddTab] = useState('manual')
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [aiRawText, setAiRawText] = useState('')
  const [aiImportOpen, setAiImportOpen] = useState(false)
  const [aiImportText, setAiImportText] = useState('')
  const [aiError, setAiError] = useState('')
  const [aiSuccess, setAiSuccess] = useState('')
  const aiSuccessTimer = useRef(null)

  const today = new Date().toISOString().slice(0, 10)
  const internalEnabled = !!settings?.internalNotesEnabled
  const aiPromptMode = settings?.aiPromptMode || 'download'
  const isClipboard = aiPromptMode === 'clipboard'

  const flashSuccess = (msg) => {
    setAiSuccess(msg)
    clearTimeout(aiSuccessTimer.current)
    aiSuccessTimer.current = setTimeout(() => setAiSuccess(''), 3500)
  }

  const allTasks = useMemo(() =>
    buildAllTasks(meetingNotes, standaloneTasks, internalEnabled), [meetingNotes, standaloneTasks, internalEnabled])

  const customers = useMemo(() =>
    [...new Set(allTasks.map((t) => t.customer).filter(Boolean))].sort(), [allTasks])
  const assignees = useMemo(() =>
    [...new Set(allTasks.map((t) => t.assignee).filter(Boolean))].sort(), [allTasks])

  const overdueCount = useMemo(() =>
    allTasks.filter((t) => t.endDate && t.endDate < today && t.status !== 'complete').length,
  [allTasks, today])

  const visible = useMemo(() => {
    let list = allTasks.filter((t) => {
      if (!showComplete && t.status === 'complete') return false
      if (filterCustomer && t.customer !== filterCustomer) return false
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
  }, [allTasks, showComplete, filterCustomer, filterAssignee, sortBy, sortAsc, showOverdueOnly, today])

  const handleOpenNote = (noteId) => {
    update({ activeSection: 'meetings', pendingOpenNoteId: noteId })
  }

  const handleEditStandalone = (task) => {
    setFormData({ text: task.text, assignee: task.assignee || '', startDate: task.startDate || '', endDate: task.endDate || '', status: task.status || 'planned' })
    setEditingTaskId(task.id)
    setShowAddForm(true)
    setAddTab('manual')
    setAiError('')
  }

  const handleDeleteStandalone = (taskId) => {
    deleteStandaloneTask(taskId)
  }

  const openAddForm = () => {
    setFormData({ ...EMPTY_FORM, assignee: settings?.yourName || '' })
    setEditingTaskId(null)
    setShowAddForm(true)
    setAiRawText('')
    setAiImportText('')
    setAiImportOpen(false)
    setAiError('')
  }

  const closeAddForm = () => {
    setShowAddForm(false)
    setEditingTaskId(null)
    setFormData(EMPTY_FORM)
    setAiRawText('')
    setAiImportText('')
    setAiImportOpen(false)
    setAiError('')
  }

  const handleSaveForm = () => {
    if (!formData.text.trim()) return
    const now = new Date().toISOString()
    if (editingTaskId) {
      const existing = (standaloneTasks || []).find((t) => t.id === editingTaskId)
      if (existing) saveStandaloneTask({ ...existing, ...formData, updatedAt: now })
    } else {
      saveStandaloneTask({ id: uuid(), ...formData, createdAt: now, updatedAt: now })
    }
    closeAddForm()
  }

  const handleAiExport = () => {
    const existing = (standaloneTasks || []).map((t) => ({ text: t.text, status: t.status }))
    const prompt = buildStandaloneTasksAIPrompt(aiRawText, existing, settings, aiPromptMode)
    const json = JSON.stringify(prompt, null, 2)
    if (isClipboard) {
      navigator.clipboard.writeText(json).catch(() => {})
      flashSuccess('Prompt copied to clipboard.')
    } else {
      const blob = new Blob([json], { type: 'application/json' })
      downloadBlob(blob, `ai_prompt_standalone_tasks.json`)
    }
    setAiImportOpen(true)
    setAiError('')
  }

  const handleAiApply = () => {
    const stripped = aiImportText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    try {
      const parsed = JSON.parse(stripped)
      const taskList = parsed.tasks ?? (Array.isArray(parsed) ? parsed : null)
      if (!taskList || !taskList.length) { setAiError('No tasks found in response.'); return }
      const now = new Date().toISOString()
      taskList.forEach((t) => {
        saveStandaloneTask({
          id: uuid(),
          text: t.text || '',
          assignee: t.assignee || settings?.yourName || '',
          status: t.status || 'planned',
          startDate: t.startDate || '',
          endDate: t.endDate || '',
          createdAt: now,
          updatedAt: now,
        })
      })
      setAiImportText('')
      setAiImportOpen(false)
      setAiRawText('')
      setAiError('')
      flashSuccess(`Added ${taskList.length} task${taskList.length !== 1 ? 's' : ''}.`)
      setShowAddForm(false)
    } catch {
      setAiError('Invalid JSON — check the response format.')
    }
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
        <div className="flex items-center gap-2">
          {window.electronAPI?.openTaskWidget && (
            <button
              onClick={() => window.electronAPI.openTaskWidget()}
              className="btn-secondary flex items-center gap-1.5 text-sm"
              title="Open a floating task list that stays on top of other windows"
            >
              <PictureInPicture2 size={14} />
              Floating Widget
            </button>
          )}
          <button
            onClick={showAddForm ? closeAddForm : openAddForm}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            {showAddForm ? <X size={14} /> : <Plus size={14} />}
            {showAddForm ? 'Cancel' : 'Add Task'}
          </button>
        </div>
      </div>

      {/* Add / Edit Task Panel */}
      {showAddForm && (
        <div className="card p-4 space-y-3 border-2 border-accent/20">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {editingTaskId ? 'Edit Task' : 'New Task'}
            </h2>
            {/* Tab pills */}
            {!editingTaskId && (
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs">
                <button
                  onClick={() => setAddTab('manual')}
                  className={`px-3 py-1.5 font-medium transition-colors ${addTab === 'manual' ? 'bg-accent text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  Manual
                </button>
                <button
                  onClick={() => setAddTab('ai')}
                  className={`px-3 py-1.5 font-medium transition-colors flex items-center gap-1 ${addTab === 'ai' ? 'bg-accent text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  <Brain size={11} /> AI
                </button>
              </div>
            )}
          </div>

          {/* Manual tab */}
          {(addTab === 'manual' || editingTaskId) && (
            <div className="space-y-3">
              <div>
                <label className="label text-xs">Task <span className="text-red-400">*</span></label>
                <input
                  className="input text-sm w-full"
                  placeholder="Task description…"
                  value={formData.text}
                  onChange={(e) => setFormData((f) => ({ ...f, text: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSaveForm() }}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="label text-xs">Assignee</label>
                  <input
                    className="input text-sm"
                    placeholder="Name"
                    value={formData.assignee}
                    onChange={(e) => setFormData((f) => ({ ...f, assignee: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-xs">Start date</label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={formData.startDate}
                    onChange={(e) => setFormData((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-xs">End date</label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={formData.endDate}
                    onChange={(e) => setFormData((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label text-xs">Status</label>
                  <select
                    className={`input text-sm font-medium ${STATUS_STYLES[formData.status]?.badge || STATUS_STYLES.planned.badge}`}
                    value={formData.status}
                    onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="planned">Planned</option>
                    <option value="inProgress">In Progress</option>
                    <option value="complete">Complete</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveForm}
                  disabled={!formData.text.trim()}
                  className="btn-primary text-sm py-1.5 px-4 disabled:opacity-40"
                >
                  {editingTaskId ? 'Save Changes' : 'Add Task'}
                </button>
                <button onClick={closeAddForm} className="btn-secondary text-sm py-1.5 px-3">Cancel</button>
              </div>
            </div>
          )}

          {/* AI tab */}
          {addTab === 'ai' && !editingTaskId && (
            <div className="space-y-3">
              <div>
                <label className="label text-xs">Raw text / transcript</label>
                <textarea
                  className="input text-sm resize-none w-full"
                  rows={5}
                  placeholder="Paste any notes, transcript, or unstructured text with action items. The AI will extract and structure them into tasks."
                  value={aiRawText}
                  onChange={(e) => setAiRawText(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isClipboard ? (
                  <button
                    onClick={handleAiExport}
                    className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3"
                  >
                    <Clipboard size={12} /> Copy Prompt
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleAiExport}
                      className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3"
                    >
                      <Download size={12} /> Download Prompt
                    </button>
                    <button
                      onClick={() => { setAiImportOpen((v) => !v); setAiError('') }}
                      className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3"
                    >
                      <Brain size={12} className="text-green-500" /> Paste AI Response
                    </button>
                  </>
                )}
                {aiSuccess && <span className="text-xs text-green-600 dark:text-green-400">{aiSuccess}</span>}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                {isClipboard
                  ? 'Click "Copy Prompt" to copy the JSON prompt, paste it into Claude (or any AI), then paste the response back below.'
                  : 'Click "Download Prompt" to get the JSON file, upload it to Claude (or any AI), then paste the response back.'}
              </p>
              {aiImportOpen && (
                <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Paste AI response</p>
                  <textarea
                    className="input text-xs font-mono resize-none w-full"
                    rows={4}
                    value={aiImportText}
                    onChange={(e) => setAiImportText(e.target.value)}
                    placeholder={'{"tasks": [{"text":"...", "assignee":"...", "status":"planned"}]}'}
                    autoFocus={isClipboard}
                  />
                  {aiError && <p className="text-xs text-red-500 dark:text-red-400">{aiError}</p>}
                  <button onClick={handleAiApply} className="btn-primary flex items-center gap-1.5 text-xs py-1 px-3">
                    <Brain size={12} /> Apply
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
              ? 'No tasks yet. Add a standalone task above, or add tasks inside any meeting note.'
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
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Created</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Source</th>
                {internalEnabled && (
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</th>
                )}
                <th
                  className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  onClick={() => toggleSort('status')}
                >
                  Status <SortIcon col="status" />
                </th>
                <th className="px-3 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {visible.map((task) => {
                const st = STATUS_STYLES[task.status] || STATUS_STYLES.planned
                const isComplete = task.status === 'complete'
                const overdue = isOverdue(task)
                return (
                  <tr
                    key={task.isStandalone ? `standalone-${task.id}` : `${task.noteId}-${task.sectionId}-${task.id}`}
                    className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group"
                  >
                    {/* Task text */}
                    <td className="px-4 py-3">
                      <span className={`font-medium ${isComplete ? 'text-green-600 dark:text-green-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {task.text}
                      </span>
                    </td>

                    {/* Assignee */}
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400 text-xs">{task.assignee || '—'}</td>

                    {/* Dates */}
                    <td className={`px-3 py-3 text-xs whitespace-nowrap ${overdue ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-500'}`}>
                      {task.startDate || task.endDate
                        ? `${[formatDate(task.startDate), formatDate(task.endDate)].filter(Boolean).join(' → ')}${overdue ? ' ⚠' : ''}`
                        : '—'}
                    </td>

                    {/* Created */}
                    <td className="px-3 py-3 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                      {formatCreated(task.createdAt)}
                    </td>

                    {/* Source */}
                    <td className="px-3 py-3 text-xs">
                      {task.isStandalone ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-medium">
                          Standalone
                        </span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleOpenNote(task.noteId)}
                            title="Open meeting note"
                            className="flex items-center gap-1 text-left text-gray-700 dark:text-gray-300 font-medium hover:text-accent dark:hover:text-accent transition-colors group/src"
                          >
                            <FileText size={11} className="shrink-0 text-gray-400 dark:text-gray-500 group-hover/src:text-accent transition-colors" />
                            <span className="truncate max-w-[130px]">{task.noteTitle}</span>
                          </button>
                          {task.customer && (
                            <div className="text-gray-400 dark:text-gray-500 truncate max-w-[140px]">{task.customer}</div>
                          )}
                          <div className="text-gray-400 dark:text-gray-500">{formatDate(task.noteDate)}</div>
                        </div>
                      )}
                    </td>

                    {/* Type (internal notes) */}
                    {internalEnabled && (
                      <td className="px-3 py-3">
                        {!task.isStandalone && (
                          task.isInternal ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-medium">Internal</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 font-medium">Standard</span>
                          )
                        )}
                      </td>
                    )}

                    {/* Status */}
                    <td className="px-3 py-3">
                      <select
                        className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border-0 cursor-pointer ${st.badge}`}
                        value={task.status}
                        onChange={(e) => setTaskStatus(task, e.target.value)}
                      >
                        <option value="planned">Planned</option>
                        <option value="inProgress">In Progress</option>
                        <option value="complete">Complete</option>
                        <option value="blocked">Blocked</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3">
                      {task.isStandalone ? (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditStandalone(task)}
                            className="p-1 text-gray-400 hover:text-accent transition-colors"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteStandalone(task.id)}
                            className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : null}
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
