import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'

const DEFAULT_COLORS = ['#ff0000', '#1E3A5F', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#64748B']

function PieChart({ data, width = 300 }) {
  const items = (data || []).filter((d) => d.label && parseFloat(d.value) > 0)
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-gray-400 dark:text-gray-500">
        Add data rows to see the pie chart
      </div>
    )
  }

  const total = items.reduce((s, d) => s + (parseFloat(d.value) || 0), 0)
  const cx = width / 2
  const cy = width / 2
  const r = width / 2 - 20
  const labelR = r + 14

  let angle = -Math.PI / 2
  const slices = items.map((d, i) => {
    const val = parseFloat(d.value) || 0
    const sweep = (val / total) * 2 * Math.PI
    const midAngle = angle + sweep / 2
    const start = angle
    angle += sweep
    return { ...d, val, sweep, start, midAngle, color: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length] }
  })

  function arcPath(cx, cy, r, startA, endA) {
    const x1 = cx + r * Math.cos(startA)
    const y1 = cy + r * Math.sin(startA)
    const x2 = cx + r * Math.cos(endA)
    const y2 = cy + r * Math.sin(endA)
    const large = endA - startA > Math.PI ? 1 : 0
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
  }

  return (
    <svg width={width} height={width} style={{ display: 'block' }}>
      {slices.map((sl, i) => (
        <path
          key={i}
          d={arcPath(cx, cy, r, sl.start, sl.start + sl.sweep)}
          fill={sl.color}
          stroke="#fff"
          strokeWidth={2}
        />
      ))}
      {/* Labels for slices > 5% */}
      {slices.map((sl, i) => {
        const pct = ((sl.val / total) * 100).toFixed(0)
        if (sl.sweep < 0.2) return null
        const lx = cx + labelR * Math.cos(sl.midAngle)
        const ly = cy + labelR * Math.sin(sl.midAngle)
        const anchor = Math.cos(sl.midAngle) > 0 ? 'start' : 'end'
        return (
          <g key={`lbl-${i}`}>
            <line
              x1={cx + (r - 4) * Math.cos(sl.midAngle)}
              y1={cy + (r - 4) * Math.sin(sl.midAngle)}
              x2={lx}
              y2={ly}
              stroke={sl.color}
              strokeWidth={1}
            />
            <text x={lx + (anchor === 'start' ? 3 : -3)} y={ly + 4} textAnchor={anchor} fontSize={9} fill="#374151">
              {pct}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function PieSection({ section, onChange }) {
  const data = section.data || []

  const addRow = () =>
    onChange({ data: [...data, { id: uuid(), label: '', value: '', color: '' }] })

  const updateRow = (id, key, val) =>
    onChange({ data: data.map((r) => (r.id === id ? { ...r, [key]: val } : r)) })

  const removeRow = (id) => onChange({ data: data.filter((r) => r.id !== id) })

  return (
    <div className="space-y-4">
      {/* Chart preview */}
      <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 flex justify-center">
        <PieChart data={data} width={260} />
      </div>

      {/* Legend */}
      {data.filter((d) => d.label).length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {data.filter((d) => d.label).map((d, i) => (
            <div key={d.id} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length] }} />
              {d.label}
            </div>
          ))}
        </div>
      )}

      {/* Data table */}
      <div>
        <div className="grid gap-2 mb-1.5 px-1" style={{ gridTemplateColumns: '1fr 100px 44px 32px' }}>
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Label</span>
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Value</span>
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Colour</span>
          <span />
        </div>
        <div className="space-y-1.5">
          {data.map((row, i) => (
            <div key={row.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 100px 44px 32px' }}>
              <input
                className="input text-sm"
                value={row.label}
                onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                placeholder="Label"
              />
              <input
                className="input text-sm"
                type="number"
                value={row.value}
                onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                placeholder="0"
              />
              <input
                type="color"
                value={row.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                onChange={(e) => updateRow(row.id, 'color', e.target.value)}
                className="w-9 h-9 rounded cursor-pointer border border-gray-200 dark:border-gray-600 p-0.5"
              />
              <button onClick={() => removeRow(row.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors p-1">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        {data.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">No data points yet</p>
        )}
        <button className="mt-3 text-sm text-accent hover:text-accent-dark flex items-center gap-1.5 font-medium" onClick={addRow}>
          <Plus size={14} /> Add Slice
        </button>
      </div>
    </div>
  )
}

export { PieChart }
