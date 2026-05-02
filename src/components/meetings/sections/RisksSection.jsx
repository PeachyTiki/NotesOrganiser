import React from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Trash2 } from 'lucide-react'

const SEVERITY = [
  { value: 'low',      label: 'Low',      color: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400' },
  { value: 'medium',   label: 'Medium',   color: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400' },
  { value: 'high',     label: 'High',     color: 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400' },
]

const STATUS = [
  { value: 'open',       label: 'Open' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'mitigated',  label: 'Mitigated' },
  { value: 'closed',     label: 'Closed' },
]

function emptyRisk() {
  return { id: uuid(), risk: '', severity: 'medium', owner: '', mitigation: '', status: 'open' }
}

export default function RisksSection({ section, onChange }) {
  const items = section.items || []

  const update = (id, key, val) =>
    onChange({ items: items.map((i) => (i.id === id ? { ...i, [key]: val } : i)) })

  const add = () => onChange({ items: [...items, emptyRisk()] })

  const remove = (id) => onChange({ items: items.filter((i) => i.id !== id) })

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 py-2 text-center">No risks logged yet</p>
      )}

      {items.map((item) => {
        const sev = SEVERITY.find((s) => s.value === item.severity) || SEVERITY[1]
        return (
          <div key={item.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-2.5 space-y-2">
            <div className="flex items-start gap-2">
              <textarea
                className="input resize-none text-xs leading-relaxed min-h-10 flex-1"
                value={item.risk}
                onChange={(e) => update(item.id, 'risk', e.target.value)}
                placeholder="Describe the risk or blocker…"
                rows={2}
              />
              <button onClick={() => remove(item.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-0.5 shrink-0 mt-0.5">
                <Trash2 size={12} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 dark:text-gray-500 mb-0.5 block">Severity</label>
                <select
                  className={`w-full text-xs rounded-md px-2 py-1 border border-gray-200 dark:border-gray-600 font-medium focus:outline-none focus:ring-1 focus:ring-accent ${sev.color}`}
                  value={item.severity}
                  onChange={(e) => update(item.id, 'severity', e.target.value)}
                >
                  {SEVERITY.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 dark:text-gray-500 mb-0.5 block">Status</label>
                <select
                  className="input text-xs py-1"
                  value={item.status}
                  onChange={(e) => update(item.id, 'status', e.target.value)}
                >
                  {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                className="input text-xs"
                value={item.owner}
                onChange={(e) => update(item.id, 'owner', e.target.value)}
                placeholder="Owner"
              />
              <input
                className="input text-xs"
                value={item.mitigation}
                onChange={(e) => update(item.id, 'mitigation', e.target.value)}
                placeholder="Mitigation / action"
              />
            </div>
          </div>
        )
      })}

      <button
        onClick={add}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-400 dark:text-gray-500 hover:border-red-400 hover:text-red-500 transition-colors"
      >
        <Plus size={12} /> Add Risk
      </button>
    </div>
  )
}
