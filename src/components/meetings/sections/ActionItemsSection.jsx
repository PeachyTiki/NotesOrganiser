import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'

const STATUS_STYLES = {
  todo:       'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  inProgress: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  done:       'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300',
}

export const ACTION_STATUS_COLORS = {
  todo:       { bg: '#F1F5F9', text: '#64748B' },
  inProgress: { bg: '#FFFBEB', text: '#D97706' },
  done:       { bg: '#F0FDF4', text: '#16A34A' },
}

export default function ActionItemsSection({ section, onChange }) {
  const items = section.items || []

  const add = () =>
    onChange({ items: [...items, { id: uuid(), task: '', assignee: '', dueDate: '', status: 'todo' }] })

  const update = (id, key, val) =>
    onChange({ items: items.map((i) => (i.id === id ? { ...i, [key]: val } : i)) })

  const remove = (id) => onChange({ items: items.filter((i) => i.id !== id) })

  return (
    <div>
      <div className="grid gap-2 mb-1.5 px-1" style={{ gridTemplateColumns: '2fr 1fr 110px 110px 32px' }}>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Task</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Assignee</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Due</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Status</span>
        <span />
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '2fr 1fr 110px 110px 32px' }}>
            <input
              className="input text-sm"
              value={item.task}
              onChange={(e) => update(item.id, 'task', e.target.value)}
              placeholder="Action item…"
            />
            <input
              className="input text-sm"
              value={item.assignee}
              onChange={(e) => update(item.id, 'assignee', e.target.value)}
              placeholder="Owner"
            />
            <input
              type="date"
              className="input text-sm"
              value={item.dueDate}
              onChange={(e) => update(item.id, 'dueDate', e.target.value)}
            />
            <select
              className={`input text-sm font-medium ${STATUS_STYLES[item.status] || STATUS_STYLES.todo}`}
              value={item.status}
              onChange={(e) => update(item.id, 'status', e.target.value)}
            >
              <option value="todo">To do</option>
              <option value="inProgress">In progress</option>
              <option value="done">Done</option>
            </select>
            <button onClick={() => remove(item.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors p-1">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      {items.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">No action items yet</p>
      )}
      <button className="mt-3 text-sm text-accent hover:text-accent-dark flex items-center gap-1.5 font-medium" onClick={add}>
        <Plus size={14} /> Add Action Item
      </button>
    </div>
  )
}
