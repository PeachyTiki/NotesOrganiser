import { useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import Popover from './Popover'

// Drop-in replacement for a native <select className="input">, styled to
// match the app's "liquid glass" look and portal-positioned via Popover so it
// never gets clipped/hidden behind a sibling card. Accepts either a flat
// option list or a grouped one (for optgroup-style menus):
//   options={[{ value, label }, ...]}
//   options={[{ group: 'Customers', items: [{ value, label }, ...] }, ...]}
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  renderOption,
  disabled = false,
  className = '',
  panelClassName = '',
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)

  const groups = options.length && options[0]?.items ? options : [{ group: null, items: options }]
  const flat = groups.flatMap((g) => g.items)
  const selected = flat.find((o) => o.value === value)

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`input flex items-center justify-between gap-2 cursor-pointer w-full text-left disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className={`truncate ${selected ? '' : 'text-gray-400 dark:text-gray-500'}`}>
          {selected ? (renderOption ? renderOption(selected, false) : selected.label) : placeholder}
        </span>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btnRef} sameWidth className={panelClassName}>
        <div className="max-h-64 overflow-y-auto py-1">
          {groups.map((g, gi) => (
            <div key={g.group ?? gi}>
              {g.group && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {g.group}
                </div>
              )}
              {g.items.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    opt.disabled ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  } ${
                    opt.value === value
                      ? 'bg-accent-light dark:bg-accent-light text-accent'
                      : 'text-gray-800 dark:text-gray-100'
                  }`}
                >
                  {renderOption ? renderOption(opt, true) : <span className="truncate">{opt.label}</span>}
                  {opt.value === value && <Check size={13} className="shrink-0 text-accent" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </Popover>
    </div>
  )
}
