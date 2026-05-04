import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { resolveRuleColor } from '../../../utils/colorUtils'

function niceTick(rough) {
  if (rough <= 0) return 1
  const exp = Math.floor(Math.log10(rough))
  const base = Math.pow(10, exp)
  if (rough / base <= 1) return base
  if (rough / base <= 2) return 2 * base
  if (rough / base <= 5) return 5 * base
  return 10 * base
}

const DEFAULT_COLORS = ['#ff0000', '#1E3A5F', '#64748B', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

export function BarChart({ data, bannerColor, colorMode, colorRules, width = 640, compact = false }) {
  const items = (data || []).filter((d) => d.label)
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-gray-400 dark:text-gray-500">
        Add data rows to see the chart
      </div>
    )
  }

  const height = compact ? 160 : 220
  const pad = { top: 20, right: 16, bottom: 48, left: 46 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom

  const values = items.map((d) => parseFloat(d.value) || 0)
  const maxVal = Math.max(...values, 1)
  const tickStep = niceTick(maxVal / 4)
  const yMax = Math.ceil(maxVal / tickStep) * tickStep
  const ticks = []
  for (let v = 0; v <= yMax; v += tickStep) ticks.push(v)

  const scaleY = plotH / yMax
  const step = plotW / items.length
  const barW = Math.min(56, step * 0.6)

  const resolveColor = (d, i) => {
    const val = parseFloat(d.value) || 0
    if (colorMode === 'rules' && colorRules && colorRules.length > 0) {
      return resolveRuleColor(colorRules, val) || bannerColor || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
    }
    if (colorMode === 'theme') return bannerColor || DEFAULT_COLORS[0]
    return d.color || bannerColor || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
  }

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      {ticks.map((tick, i) => {
        const y = pad.top + plotH - tick * scaleY
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="#E5E7EB" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9CA3AF">{tick}</text>
          </g>
        )
      })}

      {items.map((d, i) => {
        const val = parseFloat(d.value) || 0
        const bh = val * scaleY
        const x = pad.left + step * i + (step - barW) / 2
        const y = pad.top + plotH - bh
        const color = resolveColor(d, i)
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(bh, 0)} fill={color} rx={3} />
            {val > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="#374151" fontWeight="600">
                {val}
              </text>
            )}
            <text x={x + barW / 2} y={pad.top + plotH + 12} textAnchor="middle" fontSize={10} fill="#6B7280">
              {d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label}
            </text>
          </g>
        )
      })}

      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="#CBD5E1" strokeWidth={1.5} />
      <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="#CBD5E1" strokeWidth={1.5} />
    </svg>
  )
}

function ColorRulesEditor({ rules, onChange }) {
  const addRule = () => {
    const existingVals = rules.map((r) => r.value)
    let candidate = 0
    while (existingVals.includes(candidate)) candidate++
    onChange([...rules, { id: uuid(), value: candidate, color: '#10B981' }])
  }

  const updateRule = (id, key, val) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, [key]: key === 'value' ? parseFloat(val) || 0 : val } : r)))

  const removeRule = (id) => onChange(rules.filter((r) => r.id !== id))

  const sorted = [...rules].sort((a, b) => a.value - b.value)

  return (
    <div className="space-y-2 mt-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Bars are coloured by interpolating between these value stops (sorted by value).
      </p>
      {sorted.map((rule) => (
        <div key={rule.id} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-14">at value</span>
          <input
            type="number"
            className="input text-xs w-20"
            value={rule.value}
            onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
          />
          <input
            type="color"
            value={rule.color}
            onChange={(e) => updateRule(rule.id, 'color', e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-200 dark:border-gray-600 p-0.5 shrink-0"
          />
          <span className="text-xs text-gray-400 flex-1" style={{ color: rule.color }}>■ {rule.color}</span>
          <button onClick={() => removeRule(rule.id)} className="text-gray-300 hover:text-red-500 p-0.5">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button className="text-xs text-accent hover:text-accent-dark flex items-center gap-1 font-medium" onClick={addRule}>
        <Plus size={12} /> Add stop
      </button>
    </div>
  )
}

export default function GraphSection({ section, onChange, t }) {
  const data = section.data || []
  const colorMode = section.colorMode || 'individual'
  const colorRules = section.colorRules || []

  const addRow = () =>
    onChange({ data: [...data, { id: uuid(), label: '', value: '', color: '' }] })

  const updateRow = (id, key, val) =>
    onChange({ data: data.map((r) => (r.id === id ? { ...r, [key]: val } : r)) })

  const removeRow = (id) => onChange({ data: data.filter((r) => r.id !== id) })

  return (
    <div className="space-y-4">
      {/* Color mode */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Colour</label>
        {[
          { value: 'individual', label: 'Per bar' },
          { value: 'theme', label: 'Theme' },
          { value: 'rules', label: 'Rules' },
        ].map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-600 dark:text-gray-300">
            <input
              type="radio"
              name={`graph-color-${section.id}`}
              value={opt.value}
              checked={colorMode === opt.value}
              onChange={() => onChange({ colorMode: opt.value })}
              className="accent-accent"
            />
            {opt.label}
          </label>
        ))}
      </div>

      {colorMode === 'rules' && (
        <ColorRulesEditor
          rules={colorRules}
          onChange={(r) => onChange({ colorRules: r })}
        />
      )}

      {/* Chart preview */}
      <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 overflow-x-auto">
        <BarChart data={data} colorMode={colorMode} colorRules={colorRules} compact />
      </div>

      {/* Data table */}
      <div>
        <div
          className="grid gap-2 mb-1.5 px-1"
          style={{ gridTemplateColumns: colorMode === 'individual' ? '1fr 100px 44px 32px' : '1fr 100px 32px' }}
        >
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t('label')}</span>
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t('value')}</span>
          {colorMode === 'individual' && (
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Colour</span>
          )}
          <span />
        </div>
        <div className="space-y-1.5">
          {data.map((row, i) => (
            <div
              key={row.id}
              className="grid gap-2 items-center"
              style={{ gridTemplateColumns: colorMode === 'individual' ? '1fr 100px 44px 32px' : '1fr 100px 32px' }}
            >
              <input
                className="input text-sm"
                value={row.label}
                onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                placeholder={t('label')}
              />
              <input
                className="input text-sm"
                type="number"
                value={row.value}
                onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                placeholder="0"
              />
              {colorMode === 'individual' && (
                <input
                  type="color"
                  value={row.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                  onChange={(e) => updateRow(row.id, 'color', e.target.value)}
                  className="w-9 h-9 rounded cursor-pointer border border-gray-200 dark:border-gray-600 p-0.5"
                />
              )}
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
          <Plus size={14} /> Add Data Point
        </button>
      </div>
    </div>
  )
}
