import React, { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Plus, Image, ChevronDown, Check } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useApp } from '../../context/AppContext'

// ─── Font list ────────────────────────────────────────────────────────────────
const FONTS = [
  // Google sans-serif
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  // System sans-serif
  'Arial', 'Helvetica', 'Verdana', 'Trebuchet MS',
  // Serif
  'Playfair Display', 'Merriweather', 'Georgia', 'Times New Roman',
  // Monospace
  'Courier New',
]

// ─── Colour helpers ───────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim())
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')
}
function darkenHex(hex, pct) {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToHex(rgb[0] * (1 - pct), rgb[1] * (1 - pct), rgb[2] * (1 - pct)) : hex
}
function lightenHex(hex, pct) {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToHex(rgb[0] + (255 - rgb[0]) * pct, rgb[1] + (255 - rgb[1]) * pct, rgb[2] + (255 - rgb[2]) * pct) : hex
}

// ─── Palette presets ──────────────────────────────────────────────────────────
const FIXED_PRESETS = [
  { name: 'Adobe Classic',  colors: ['#ff0000', '#1E293B', '#64748B', '#F1F5F9'] },
  { name: 'Ocean Blue',     colors: ['#0284C7', '#0C4A6E', '#38BDF8', '#BAE6FD', '#F0F9FF'] },
  { name: 'Forest',         colors: ['#16A34A', '#14532D', '#4ADE80', '#DCFCE7'] },
  { name: 'Sunset',         colors: ['#EA580C', '#7C2D12', '#FB923C', '#FED7AA'] },
  { name: 'Royal Purple',   colors: ['#7C3AED', '#2E1065', '#A78BFA', '#EDE9FE'] },
  { name: 'Midnight',       colors: ['#0F172A', '#1E293B', '#475569', '#94A3B8', '#F1F5F9'] },
  { name: 'Gold',           colors: ['#B45309', '#78350F', '#FCD34D', '#FDE68A'] },
  { name: 'Rose',           colors: ['#E11D48', '#881337', '#FB7185', '#FFE4E6'] },
  { name: 'Teal',           colors: ['#0D9488', '#134E4A', '#2DD4BF', '#CCFBF1'] },
  { name: 'Monochrome',     colors: ['#000000', '#374151', '#6B7280', '#D1D5DB', '#F9FAFB'] },
]

function getBannerPresets(banner) {
  return [
    {
      name: 'Banner + Corporate',
      colors: [banner, darkenHex(banner, 0.35), '#1E293B', '#64748B', '#F1F5F9'],
    },
    {
      name: 'Banner + Light',
      colors: [banner, lightenHex(banner, 0.55), darkenHex(banner, 0.28), '#9CA3AF', '#F8FAFC'],
    },
    {
      name: 'Banner + Minimal',
      colors: [banner, '#1E293B', '#6B7280', '#E2E8F0'],
    },
  ]
}

// ─── Other constants ──────────────────────────────────────────────────────────
const LOGO_POSITIONS = [
  { value: 'top-left',   label: 'Top Left' },
  { value: 'top-right',  label: 'Top Right' },
  { value: 'top-center', label: 'Top Center' },
]
const DATE_ALIGNMENTS = [
  { value: 'left',   label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right',  label: 'Right' },
]
const DATE_ZONES = [
  { value: 'header', label: 'Header' },
  { value: 'footer', label: 'Footer' },
]


function emptyTemplate() {
  return {
    id: uuid(),
    name: '',
    bannerColor: '#ff0000',
    fontFamily: 'Inter',
    colorPalette: ['#ff0000', '#1E293B', '#64748B', '#F1F5F9'],
    logo: { show: false, position: 'top-left', data: null },
    dateConfig: { show: true, zone: 'header', alignment: 'right' },
    createdAt: new Date().toISOString(),
  }
}

// ─── FontPicker ───────────────────────────────────────────────────────────────
function FontPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input flex items-center justify-between cursor-pointer w-full text-left"
        style={{ fontFamily: value }}
      >
        <span>{value}</span>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {FONTS.map((font) => (
              <button
                key={font}
                type="button"
                onClick={() => { onChange(font); setOpen(false) }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  value === font
                    ? 'bg-accent-light dark:bg-accent-light text-accent'
                    : 'text-gray-800 dark:text-gray-100'
                }`}
                style={{ fontFamily: font }}
              >
                {font}
                {value === font && <Check size={13} className="shrink-0 text-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PalettePresets ───────────────────────────────────────────────────────────
function PresetChip({ preset, isBannerBased, onApply }) {
  return (
    <button
      type="button"
      onClick={() => onApply(preset.colors)}
      className="group flex flex-col items-start gap-1.5 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-accent dark:hover:border-accent hover:bg-accent-light/30 dark:hover:bg-accent-light transition-all text-left w-full"
      title={`Apply "${preset.name}"`}
    >
      <div className="flex gap-1 flex-wrap">
        {preset.colors.map((c, i) => (
          <span
            key={i}
            className="block w-4 h-4 rounded-full border border-white dark:border-gray-800 shadow-sm shrink-0"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-accent transition-colors leading-tight truncate w-full">
        {preset.name}
      </span>
      {isBannerBased && (
        <span className="text-[10px] text-accent/70 font-medium leading-none">uses banner colour</span>
      )}
    </button>
  )
}

function PalettePresets({ bannerColor, onApply }) {
  const bannerPresets = getBannerPresets(bannerColor)

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        Quick Presets
      </p>

      {/* Banner-based (first 3) */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {bannerPresets.map((preset) => (
          <PresetChip key={preset.name} preset={preset} isBannerBased onApply={onApply} />
        ))}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2 my-2">
        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">fixed palettes</span>
        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
      </div>

      {/* Fixed presets */}
      <div className="grid grid-cols-3 gap-2">
        {FIXED_PRESETS.map((preset) => (
          <PresetChip key={preset.name} preset={preset} isBannerBased={false} onApply={onApply} />
        ))}
      </div>
    </div>
  )
}

// ─── Main editor ──────────────────────────────────────────────────────────────
export default function TemplateEditor({ template, onClose }) {
  const { saveTemplate } = useApp()
  const [form, setForm] = useState(template ? { ...template } : emptyTemplate())
  const [newColor, setNewColor] = useState('#000000')
  const logoRef = useRef()

  const set = (path, value) => {
    setForm((f) => {
      const parts = path.split('.')
      if (parts.length === 1) return { ...f, [path]: value }
      return { ...f, [parts[0]]: { ...f[parts[0]], [parts[1]]: value } }
    })
  }

  const addColor = () => {
    if (!form.colorPalette.includes(newColor)) set('colorPalette', [...form.colorPalette, newColor])
  }

  const removeColor = (c) => set('colorPalette', form.colorPalette.filter((x) => x !== c))

  const applyPreset = (colors) => set('colorPalette', [...colors])

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => set('logo', { ...form.logo, data: ev.target.result, show: true })
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (!form.name.trim()) { alert('Please enter a template name.'); return }
    saveTemplate({ ...form, updatedAt: new Date().toISOString() })
    onClose()
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} className="btn-ghost flex items-center gap-1.5 text-sm">
          <ArrowLeft size={15} /> Back
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {template ? 'Edit Template' : 'New Template'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: settings ── */}
        <div className="space-y-5">

          {/* Name */}
          <div className="card p-4">
            <label className="label">Template Name</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Acme Corp Standard" />
          </div>

          {/* Banner colour */}
          <div className="card p-4">
            <label className="label">Banner Colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.bannerColor}
                onChange={(e) => set('bannerColor', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-gray-200 dark:border-gray-600 p-0.5"
              />
              <input className="input" value={form.bannerColor} onChange={(e) => set('bannerColor', e.target.value)} placeholder="#ff0000" />
            </div>
          </div>

          {/* Font family */}
          <div className="card p-4">
            <label className="label">Font Family</label>
            <FontPicker value={form.fontFamily} onChange={(f) => set('fontFamily', f)} />
          </div>

          {/* Colour palette */}
          <div className="card p-4">
            <label className="label">Colour Palette</label>

            {/* Presets */}
            <PalettePresets bannerColor={form.bannerColor} onApply={applyPreset} />

            {/* Current palette swatches */}
            {form.colorPalette.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {form.colorPalette.map((c, idx) => (
                  <div key={`${c}-${idx}`} className="relative group/color">
                    <span
                      className="block w-8 h-8 rounded-full border-2 border-white dark:border-gray-700 shadow cursor-default"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                    <button
                      onClick={() => removeColor(c)}
                      className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full w-4 h-4 items-center justify-center text-xs hidden group-hover/color:flex"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add custom colour */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-gray-200 dark:border-gray-600 p-0.5 shrink-0"
              />
              <input className="input" value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="#000000" />
              <button className="btn-secondary flex items-center gap-1 whitespace-nowrap" onClick={addColor}>
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          {/* Logo */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Logo</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.logo?.show || false} onChange={(e) => set('logo', { ...form.logo, show: e.target.checked })} className="rounded" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Show on notes</span>
              </label>
            </div>

            <input ref={logoRef} type="file" accept="image/*,.svg" className="hidden" onChange={handleLogoUpload} />
            <button className="btn-secondary flex items-center gap-2 mb-3" onClick={() => logoRef.current.click()}>
              <Image size={15} /> {form.logo?.data ? 'Replace Logo' : 'Upload Logo'}
            </button>

            {form.logo?.data && (
              <div className="mb-3 flex items-center gap-3">
                <img src={form.logo.data} alt="Logo preview" className="h-10 object-contain border border-gray-100 dark:border-gray-700 rounded p-1 bg-white" />
                <button className="text-xs text-red-500 hover:text-red-600" onClick={() => set('logo', { ...form.logo, data: null, show: false })}>
                  Remove
                </button>
              </div>
            )}

            {form.logo?.show && (
              <div>
                <label className="label text-xs">Position</label>
                <select className="input" value={form.logo?.position || 'top-left'} onChange={(e) => set('logo', { ...form.logo, position: e.target.value })}>
                  {LOGO_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Date config */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Date</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.dateConfig?.show !== false} onChange={(e) => set('dateConfig', { ...form.dateConfig, show: e.target.checked })} className="rounded" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Show date</span>
              </label>
            </div>

            {form.dateConfig?.show !== false && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Zone</label>
                  <select className="input" value={form.dateConfig?.zone || 'header'} onChange={(e) => set('dateConfig', { ...form.dateConfig, zone: e.target.value })}>
                    {DATE_ZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Alignment</label>
                  <select className="input" value={form.dateConfig?.alignment || 'right'} onChange={(e) => set('dateConfig', { ...form.dateConfig, alignment: e.target.value })}>
                    {DATE_ALIGNMENTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button className="btn-primary flex-1" onClick={handleSave}>Save Template</button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>

        {/* ── Right: preview ── */}
        <div>
          <p className="label mb-3">Preview</p>
          <TemplatePreview form={form} />
        </div>
      </div>
    </div>
  )
}

// ─── Template preview ─────────────────────────────────────────────────────────
function TemplatePreview({ form }) {
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const logoJustify = form.logo?.position === 'top-right' ? 'justify-end' : form.logo?.position === 'top-center' ? 'justify-center' : 'justify-start'
  const dateAlign = form.dateConfig?.alignment === 'right' ? 'text-right' : form.dateConfig?.alignment === 'center' ? 'text-center' : 'text-left'
  const showDateInHeader = form.dateConfig?.show !== false && form.dateConfig?.zone === 'header'
  const showDateInFooter = form.dateConfig?.show !== false && form.dateConfig?.zone === 'footer'

  return (
    <div className="rounded-xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-700 sticky top-20" style={{ fontFamily: form.fontFamily || 'Inter' }}>
      <div className="h-12 flex items-center px-4" style={{ backgroundColor: form.bannerColor || '#ff0000' }}>
        {form.logo?.show && form.logo?.data
          ? <div className={`flex w-full ${logoJustify}`}><img src={form.logo.data} alt="Logo" className="h-8 object-contain" /></div>
          : <span className="text-white font-semibold text-sm">Meeting Notes</span>
        }
      </div>

      <div className="bg-white dark:bg-gray-900 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        {form.logo?.show && form.logo?.data && <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">Meeting Notes</div>}
        {showDateInHeader && <p className={`text-xs text-gray-500 dark:text-gray-400 ${dateAlign}`}>{dateStr}</p>}
      </div>

      <div className="bg-white dark:bg-gray-900 px-4 py-4 min-h-24">
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-3/4 mb-2" />
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-full mb-2" />
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-2/3 mb-2" />
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-5/6" />
      </div>

      {showDateInFooter && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <p className={`text-xs text-gray-500 dark:text-gray-400 ${dateAlign}`}>{dateStr}</p>
        </div>
      )}

      {form.colorPalette?.length > 0 && (
        <div className="flex h-2">
          {form.colorPalette.map((c, i) => <div key={i} className="flex-1" style={{ backgroundColor: c }} />)}
        </div>
      )}
    </div>
  )
}
