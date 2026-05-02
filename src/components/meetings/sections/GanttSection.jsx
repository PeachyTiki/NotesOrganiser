import React from 'react'
import { Plus, Trash2, Table, TableProperties } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { onTrackColor } from '../../../utils/colorUtils'

// ─── Date utilities ───────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return null
  const d = new Date(str + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function toISO(d) {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function addWorkingDays(startStr, numDays) {
  const start = parseDate(startStr)
  if (!start) return ''
  const n = parseInt(numDays, 10)
  if (!n || n <= 0) return ''
  let count = 0
  const cur = new Date(start)
  while (count < n) {
    cur.setDate(cur.getDate() + 1)
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return toISO(cur)
}

function countWorkingDays(startStr, endStr) {
  const s = parseDate(startStr)
  const e = parseDate(endStr)
  if (!s || !e || e <= s) return null
  let count = 0
  const cur = new Date(s)
  cur.setDate(cur.getDate() + 1)
  while (cur <= e) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function fmtShort(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function fmtMedium(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ─── Axis tick generation ─────────────────────────────────────────────────────

function getAxisTicks(minTime, maxTime) {
  const spanDays = (maxTime - minTime) / 86400000
  const ticks = []

  if (spanDays <= 21) {
    // Daily
    const cur = new Date(minTime); cur.setHours(0, 0, 0, 0)
    while (cur.getTime() <= maxTime) {
      ticks.push({ time: cur.getTime(), label: fmtShort(cur) })
      cur.setDate(cur.getDate() + 1)
    }
  } else if (spanDays <= 84) {
    // Every Monday
    const cur = new Date(minTime); cur.setHours(0, 0, 0, 0)
    const dow = cur.getDay()
    if (dow !== 1) cur.setDate(cur.getDate() + ((8 - dow) % 7 || 7))
    while (cur.getTime() <= maxTime) {
      ticks.push({ time: cur.getTime(), label: fmtShort(cur) })
      cur.setDate(cur.getDate() + 7)
    }
  } else if (spanDays <= 730) {
    // 1st of each month
    const cur = new Date(minTime); cur.setDate(1); cur.setHours(0, 0, 0, 0)
    while (cur.getTime() <= maxTime) {
      ticks.push({ time: cur.getTime(), label: cur.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) })
      cur.setMonth(cur.getMonth() + 1)
    }
  } else {
    // Quarterly
    const cur = new Date(minTime)
    cur.setDate(1); cur.setMonth(Math.floor(cur.getMonth() / 3) * 3); cur.setHours(0, 0, 0, 0)
    while (cur.getTime() <= maxTime) {
      const q = Math.floor(cur.getMonth() / 3) + 1
      ticks.push({ time: cur.getTime(), label: `Q${q} '${String(cur.getFullYear()).slice(2)}` })
      cur.setMonth(cur.getMonth() + 3)
    }
  }

  // Ensure the very first start date and very last end date appear as boundary labels
  const hasBoundaryStart = ticks.some((t) => Math.abs(t.time - minTime) < 86400000 * 0.6)
  const hasBoundaryEnd = ticks.some((t) => Math.abs(t.time - maxTime) < 86400000 * 0.6)

  if (!hasBoundaryStart) {
    ticks.unshift({ time: minTime, label: fmtMedium(new Date(minTime)), boundary: true })
  } else {
    const first = ticks.find((t) => Math.abs(t.time - minTime) < 86400000 * 1.5)
    if (first) { first.boundary = true; first.label = fmtMedium(new Date(minTime)) }
  }
  if (!hasBoundaryEnd) {
    ticks.push({ time: maxTime, label: fmtMedium(new Date(maxTime)), boundary: true })
  } else {
    const last = [...ticks].reverse().find((t) => Math.abs(t.time - maxTime) < 86400000 * 1.5)
    if (last) { last.boundary = true; last.label = fmtMedium(new Date(maxTime)) }
  }

  return ticks.sort((a, b) => a.time - b.time)
}

// ─── Gantt SVG chart ──────────────────────────────────────────────────────────

export function GanttChart({ data, colorMode, bannerColor, width = 640 }) {
  const rows = (data || []).filter((r) => r.label && r.startDate && r.endDate)
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-16 text-xs text-gray-400 dark:text-gray-500">
        Add rows with start and end dates to see the chart
      </div>
    )
  }

  // Domain: exactly first start → last end
  const allStarts = rows.map((r) => parseDate(r.startDate)).filter(Boolean)
  const allEnds = rows.map((r) => parseDate(r.endDate)).filter(Boolean)
  const minTime = Math.min(...allStarts.map((d) => d.getTime()))
  const maxTime = Math.max(...allEnds.map((d) => d.getTime()))
  const span = maxTime - minTime || 86400000

  const rowH = 30
  const labelW = 130
  const axisH = 28
  const padTop = 4
  const padRight = 12
  const plotW = width - labelW - padRight
  const totalH = padTop + rows.length * rowH + axisH

  const toX = (d) => labelW + ((d.getTime() - minTime) / span) * plotW

  const ticks = getAxisTicks(minTime, maxTime)

  // Deduplicate ticks that would render too close together (< 30px)
  const px = (t) => labelW + ((t.time - minTime) / span) * plotW
  const visibleTicks = ticks.filter((tk, i) => {
    if (i === 0 || i === ticks.length - 1) return true // always show boundaries
    const prev = ticks[i - 1]
    return px(tk) - px(prev) >= 30
  })

  return (
    <svg width={width} height={totalH} style={{ overflow: 'visible', display: 'block' }}>
      {/* Row stripes */}
      {rows.map((_, i) =>
        i % 2 === 1 ? (
          <rect key={i} x={labelW} y={padTop + i * rowH} width={plotW} height={rowH} fill="#F8FAFC" />
        ) : null
      )}

      {/* Grid lines at ticks */}
      {visibleTicks.map((tk, i) => {
        const x = px(tk)
        return (
          <line key={i} x1={x} y1={padTop} x2={x} y2={padTop + rows.length * rowH}
            stroke={tk.boundary ? '#CBD5E1' : '#E5E7EB'} strokeWidth={tk.boundary ? 1.5 : 1} strokeDasharray={tk.boundary ? undefined : '3,3'} />
        )
      })}

      {/* Task bars */}
      {rows.map((row, i) => {
        const s = parseDate(row.startDate)
        const e = parseDate(row.endDate)
        if (!s || !e) return null
        const x1 = toX(s)
        const x2 = toX(e)
        const barW = Math.max(x2 - x1, 6)
        const y = padTop + i * rowH
        const pct = parseFloat(row.onTrack) || 0
        const barColor = colorMode === 'dynamic' ? onTrackColor(pct) : (bannerColor || '#E8210A')
        const wDays = countWorkingDays(row.startDate, row.endDate)

        return (
          <g key={row.id}>
            <text x={labelW - 8} y={y + rowH / 2 + 4} textAnchor="end" fontSize={10} fill="#374151">
              {row.label.length > 18 ? row.label.slice(0, 18) + '…' : row.label}
            </text>
            <rect x={x1} y={y + 7} width={barW} height={rowH - 14} fill={barColor} rx={3} opacity={0.9} />
            {barW > 28 && (
              <text x={x1 + barW / 2} y={y + rowH / 2 + 4} textAnchor="middle" fontSize={8} fill="#fff" fontWeight="600">
                {colorMode === 'dynamic' && row.onTrack !== ''
                  ? `${pct}%`
                  : wDays != null ? `${wDays}d` : ''}
              </text>
            )}
          </g>
        )
      })}

      {/* X-axis base line */}
      <line x1={labelW} y1={padTop + rows.length * rowH} x2={labelW + plotW} y2={padTop + rows.length * rowH}
        stroke="#94A3B8" strokeWidth={1.5} />

      {/* X-axis tick marks + labels */}
      {visibleTicks.map((tk, i) => {
        const x = px(tk)
        const isFirst = i === 0
        const isLast = i === visibleTicks.length - 1
        const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle'
        const clampedX = isFirst ? Math.max(x, labelW) : isLast ? Math.min(x, labelW + plotW) : x
        return (
          <g key={i}>
            <line x1={x} y1={padTop + rows.length * rowH} x2={x} y2={padTop + rows.length * rowH + 5}
              stroke={tk.boundary ? '#94A3B8' : '#CBD5E1'} strokeWidth={1} />
            <text x={clampedX} y={padTop + rows.length * rowH + 17}
              textAnchor={anchor} fontSize={9}
              fill={tk.boundary ? '#374151' : '#9CA3AF'}
              fontWeight={tk.boundary ? '600' : 'normal'}
            >
              {tk.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Description table ────────────────────────────────────────────────────────

export function GanttDescriptionTable({ data, bannerColor }) {
  const rows = (data || []).filter((r) => r.label && r.startDate && r.endDate)
  if (rows.length === 0) return null

  const thStyle = { textAlign: 'left', padding: '5px 8px', fontSize: 11, fontWeight: 600, color: '#64748B', borderBottom: '2px solid #E2E8F0' }
  const tdStyle = { padding: '6px 8px', fontSize: 12, color: '#374151', verticalAlign: 'top', borderBottom: '1px solid #F1F5F9' }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
      <thead>
        <tr>
          <th style={thStyle}>Task</th>
          <th style={thStyle}>Start</th>
          <th style={thStyle}>End</th>
          <th style={thStyle}>Working days</th>
          <th style={thStyle}>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const s = parseDate(row.startDate)
          const e = parseDate(row.endDate)
          const wDays = countWorkingDays(row.startDate, row.endDate)
          const pct = parseFloat(row.onTrack)
          return (
            <tr key={row.id}>
              <td style={{ ...tdStyle, fontWeight: 500, color: '#0F172A' }}>
                {row.label}
                {!isNaN(pct) && row.onTrack !== '' && (
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: bannerColor }}>
                    {pct}%
                  </span>
                )}
              </td>
              <td style={tdStyle}>{s ? fmtMedium(s) : '—'}</td>
              <td style={tdStyle}>{e ? fmtMedium(e) : '—'}</td>
              <td style={tdStyle}>{wDays != null ? `${wDays} days` : '—'}</td>
              <td style={{ ...tdStyle, color: '#64748B' }}>{row.description || '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Section editor ───────────────────────────────────────────────────────────

export default function GanttSection({ section, onChange }) {
  const data = section.data || []
  const colorMode = section.colorMode || 'theme'
  const showDescriptions = section.showDescriptions || false

  const addRow = () =>
    onChange({
      data: [...data, { id: uuid(), label: '', startDate: '', endDate: '', endMode: 'date', workDays: '', onTrack: '', description: '' }],
    })

  const updateRow = (id, key, val) => {
    onChange({
      data: data.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, [key]: val }

        // Auto-compute endDate when workDays or startDate changes in workdays mode
        if (updated.endMode === 'workdays') {
          if (key === 'workDays' || key === 'startDate') {
            updated.endDate = addWorkingDays(updated.startDate, updated.workDays)
          }
        }
        return updated
      }),
    })
  }

  const removeRow = (id) => onChange({ data: data.filter((r) => r.id !== id) })

  const setEndMode = (id, mode) => {
    onChange({
      data: data.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, endMode: mode }
        if (mode === 'workdays' && r.startDate && r.endDate) {
          const wDays = countWorkingDays(r.startDate, r.endDate)
          updated.workDays = wDays != null ? String(wDays) : ''
        }
        if (mode === 'workdays' && updated.startDate && updated.workDays) {
          updated.endDate = addWorkingDays(updated.startDate, updated.workDays)
        }
        return updated
      }),
    })
  }

  return (
    <div className="space-y-4">
      {/* Colour mode */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide shrink-0">Colour</label>
        {[
          { value: 'theme', label: 'Theme' },
          { value: 'dynamic', label: 'Dynamic (on-track %)' },
        ].map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-600 dark:text-gray-300">
            <input
              type="radio"
              name={`gantt-color-${section.id}`}
              value={opt.value}
              checked={colorMode === opt.value}
              onChange={() => onChange({ colorMode: opt.value })}
              className="accent-accent"
            />
            {opt.label}
          </label>
        ))}
        {colorMode === 'dynamic' && (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">
            0% = <span style={{ color: '#DC2626' }}>red</span> →{' '}
            <span style={{ color: '#EAB308' }}>yellow</span> →{' '}
            <span style={{ color: '#16A34A' }}>green</span> = 100%
          </span>
        )}
      </div>

      {/* Chart preview */}
      <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 overflow-x-auto">
        <GanttChart data={data} colorMode={colorMode} bannerColor={undefined} width={560} />
      </div>

      {/* Description table toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange({ showDescriptions: !showDescriptions })}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            showDescriptions
              ? 'bg-accent text-white border-accent'
              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-accent hover:text-accent'
          }`}
        >
          <TableProperties size={13} />
          {showDescriptions ? 'Hide description table' : 'Show description table'}
        </button>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Appears below the chart in the document
        </span>
      </div>

      {/* Inline preview of description table */}
      {showDescriptions && data.filter((r) => r.label).length > 0 && (
        <div className="rounded-lg border border-gray-100 dark:border-gray-700 overflow-x-auto bg-white dark:bg-gray-800 text-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
                <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-semibold">Task</th>
                <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-semibold">Start</th>
                <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-semibold">End</th>
                <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-semibold">Working days</th>
                <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {data.filter((r) => r.label).map((row) => {
                const s = parseDate(row.startDate)
                const e = parseDate(row.endDate)
                const wDays = countWorkingDays(row.startDate, row.endDate)
                return (
                  <tr key={row.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-gray-200">{row.label}</td>
                    <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{s ? fmtMedium(s) : '—'}</td>
                    <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{e ? fmtMedium(e) : '—'}</td>
                    <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{wDays != null ? `${wDays}d` : '—'}</td>
                    <td className="px-3 py-1.5 text-gray-400 dark:text-gray-500 italic">{row.description || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Task rows */}
      <div className="space-y-2">
        {data.map((row) => {
          const endMode = row.endMode || 'date'
          const computedEnd = endMode === 'workdays' ? addWorkingDays(row.startDate, row.workDays) : null
          const wDays = endMode === 'date' ? countWorkingDays(row.startDate, row.endDate) : null

          return (
            <div key={row.id} className="rounded-lg border border-gray-100 dark:border-gray-700 p-2.5 space-y-2 bg-white dark:bg-gray-800/50">
              {/* Row 1: label + on-track + delete */}
              <div className="flex items-center gap-2">
                <input
                  className="input text-sm flex-1 min-w-0"
                  value={row.label}
                  onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                  placeholder="Task name"
                />
                {colorMode === 'dynamic' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">On-track %</span>
                    <input
                      type="number" min="0" max="100"
                      className="input text-xs py-1 w-16"
                      value={row.onTrack}
                      onChange={(e) => updateRow(row.id, 'onTrack', e.target.value)}
                      placeholder="0–100"
                    />
                  </div>
                )}
                <button onClick={() => removeRow(row.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors p-1 shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Row 2: start + end (with mode toggle) */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs text-gray-400 shrink-0">Start</span>
                  <input
                    type="date"
                    className="input text-xs py-1 w-36"
                    value={row.startDate}
                    onChange={(e) => updateRow(row.id, 'startDate', e.target.value)}
                  />
                </div>

                {/* End mode toggle */}
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs shrink-0">
                  <button
                    onClick={() => setEndMode(row.id, 'date')}
                    className={`px-2 py-1 transition-colors ${endMode === 'date' ? 'bg-accent text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    End date
                  </button>
                  <button
                    onClick={() => setEndMode(row.id, 'workdays')}
                    className={`px-2 py-1 transition-colors ${endMode === 'workdays' ? 'bg-accent text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  >
                    Working days
                  </button>
                </div>

                {endMode === 'date' ? (
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs text-gray-400 shrink-0">End</span>
                    <input
                      type="date"
                      className="input text-xs py-1 w-36"
                      value={row.endDate}
                      onChange={(e) => updateRow(row.id, 'endDate', e.target.value)}
                    />
                    {wDays != null && (
                      <span className="text-xs text-gray-400 ml-1 whitespace-nowrap">{wDays} working day{wDays !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="1"
                      className="input text-xs py-1 w-20"
                      value={row.workDays}
                      onChange={(e) => updateRow(row.id, 'workDays', e.target.value)}
                      placeholder="e.g. 10"
                    />
                    <span className="text-xs text-gray-400 shrink-0">working days</span>
                    {computedEnd && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                        → ends {fmtMedium(parseDate(computedEnd))}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Row 3: description */}
              <input
                className="input text-xs py-1 w-full"
                value={row.description || ''}
                onChange={(e) => updateRow(row.id, 'description', e.target.value)}
                placeholder="Description (optional — shown in the details table)"
              />
            </div>
          )
        })}
      </div>

      {data.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">No tasks yet</p>
      )}
      <button className="text-sm text-accent hover:text-accent-dark flex items-center gap-1.5 font-medium" onClick={addRow}>
        <Plus size={14} /> Add Task
      </button>
    </div>
  )
}
