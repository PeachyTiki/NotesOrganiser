import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'

const SERIES_COLORS = ['#ff0000', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

function LineChart({ xLabels, series, width = 600 }) {
  const hasData = series.some((s) => s.values.some((v) => v !== '' && !isNaN(parseFloat(v))))
  if (!hasData || xLabels.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-gray-400 dark:text-gray-500">
        Add X labels and series data to see the line chart
      </div>
    )
  }

  const height = 200
  const pad = { top: 20, right: 16, bottom: 40, left: 44 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom

  const allVals = series.flatMap((s) => s.values.map((v) => parseFloat(v)).filter((v) => !isNaN(v)))
  const minVal = Math.min(...allVals, 0)
  const maxVal = Math.max(...allVals, 1)
  const range = maxVal - minVal || 1

  const n = xLabels.length
  const xStep = n > 1 ? plotW / (n - 1) : plotW

  const toX = (i) => pad.left + (n > 1 ? i * plotW / (n - 1) : plotW / 2)
  const toY = (v) => pad.top + plotH - ((v - minVal) / range) * plotH

  // Grid lines
  const yTicks = 4
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => minVal + (range / yTicks) * i)

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      {/* Grid */}
      {ticks.map((tick, i) => {
        const y = toY(tick)
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="#E5E7EB" strokeWidth={1} />
            <text x={pad.left - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#9CA3AF">
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </text>
          </g>
        )
      })}

      {/* X labels */}
      {xLabels.map((lbl, i) => (
        <text key={i} x={toX(i)} y={pad.top + plotH + 14} textAnchor="middle" fontSize={9} fill="#6B7280">
          {lbl.length > 8 ? lbl.slice(0, 8) + '…' : lbl}
        </text>
      ))}

      {/* Series lines */}
      {series.map((s, si) => {
        const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length]
        const points = xLabels
          .map((_, i) => {
            const v = parseFloat(s.values[i])
            return isNaN(v) ? null : { x: toX(i), y: toY(v) }
          })

        // Build path segments (skip nulls)
        const segments = []
        let seg = []
        points.forEach((pt) => {
          if (pt) { seg.push(pt) }
          else if (seg.length) { segments.push(seg); seg = [] }
        })
        if (seg.length) segments.push(seg)

        return (
          <g key={si}>
            {segments.map((pts, pi) => (
              <polyline
                key={pi}
                points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {points.map((pt, i) => pt && (
              <circle key={i} cx={pt.x} cy={pt.y} r={3} fill={color} stroke="#fff" strokeWidth={1.5} />
            ))}
          </g>
        )
      })}

      {/* Axes */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="#CBD5E1" strokeWidth={1.5} />
      <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="#CBD5E1" strokeWidth={1.5} />
    </svg>
  )
}

export default function LineSection({ section, onChange }) {
  const xLabelsRaw = section.xLabels || ''
  const xLabels = xLabelsRaw.split(',').map((s) => s.trim()).filter(Boolean)
  const series = section.series || []

  const addSeries = () =>
    onChange({ series: [...series, { id: uuid(), name: '', color: '', values: xLabels.map(() => '') }] })

  const updateSeries = (id, key, val) =>
    onChange({ series: series.map((s) => (s.id === id ? { ...s, [key]: val } : s)) })

  const removeSeries = (id) => onChange({ series: series.filter((s) => s.id !== id) })

  const setXLabels = (raw) => {
    const newLabels = raw.split(',').map((s) => s.trim()).filter(Boolean)
    onChange({
      xLabels: raw,
      series: series.map((s) => {
        const vals = newLabels.map((_, i) => s.values[i] ?? '')
        return { ...s, values: vals }
      }),
    })
  }

  const updateValue = (seriesId, idx, val) =>
    onChange({
      series: series.map((s) => {
        if (s.id !== seriesId) return s
        const vals = [...(s.values || [])]
        vals[idx] = val
        return { ...s, values: vals }
      }),
    })

  return (
    <div className="space-y-4">
      {/* Chart preview */}
      <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 overflow-x-auto">
        <LineChart xLabels={xLabels} series={series} width={560} />
      </div>

      {/* Legend */}
      {series.filter((s) => s.name).length > 0 && (
        <div className="flex flex-wrap gap-3 px-1">
          {series.filter((s) => s.name).map((s, i) => (
            <div key={s.id} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span className="w-6 h-0.5 shrink-0 inline-block rounded" style={{ backgroundColor: s.color || SERIES_COLORS[i % SERIES_COLORS.length] }} />
              {s.name}
            </div>
          ))}
        </div>
      )}

      {/* X Labels */}
      <div>
        <label className="label text-xs">X-Axis Labels (comma-separated)</label>
        <input
          className="input text-sm"
          value={xLabelsRaw}
          onChange={(e) => setXLabels(e.target.value)}
          placeholder="Jan, Feb, Mar, Apr…"
        />
      </div>

      {/* Series */}
      {series.map((s, si) => (
        <div key={s.id} className="rounded-lg border border-gray-100 dark:border-gray-700 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              className="input text-sm flex-1"
              value={s.name}
              onChange={(e) => updateSeries(s.id, 'name', e.target.value)}
              placeholder={`Series ${si + 1} name`}
            />
            <input
              type="color"
              value={s.color || SERIES_COLORS[si % SERIES_COLORS.length]}
              onChange={(e) => updateSeries(s.id, 'color', e.target.value)}
              className="w-9 h-9 rounded cursor-pointer border border-gray-200 dark:border-gray-600 p-0.5 shrink-0"
            />
            <button onClick={() => removeSeries(s.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors p-1">
              <Trash2 size={13} />
            </button>
          </div>
          {xLabels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {xLabels.map((lbl, i) => (
                <div key={i} className="flex flex-col gap-0.5 w-20">
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{lbl}</span>
                  <input
                    type="number"
                    className="input text-xs py-1"
                    value={(s.values || [])[i] ?? ''}
                    onChange={(e) => updateValue(s.id, i, e.target.value)}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <button className="text-sm text-accent hover:text-accent-dark flex items-center gap-1.5 font-medium" onClick={addSeries}>
        <Plus size={14} /> Add Series
      </button>
    </div>
  )
}

export { LineChart }
