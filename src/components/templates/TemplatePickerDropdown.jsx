import { useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Check, Folder, FolderOpen } from 'lucide-react'
import Popover from '../ui/Popover'
import { useApp } from '../../context/AppContext'

const byName = (a, b) => a.name.localeCompare(b.name)

// Template picker for note editors — mirrors the folder tree from the
// Templates page: unfiled templates listed flat at the top, then top-level
// folders (collapsible) with their own templates and subfolders
// (collapsible, one level deeper) nested underneath. Alphabetical at every
// level, same as the Templates page itself.
export default function TemplatePickerDropdown({ value, onChange, placeholder = 'Default (plain)' }) {
  const { templates, templateFolders } = useApp()
  const [open, setOpen] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState({})
  const btnRef = useRef(null)

  const folders = templateFolders || []
  const topFolders = folders.filter((f) => !f.parentId).sort(byName)
  const subFoldersOf = (id) => folders.filter((f) => f.parentId === id).sort(byName)
  const templatesIn = (folderId) => templates.filter((t) => (t.folderId || null) === folderId).sort(byName)
  const unfiled = templatesIn(null)

  const selected = templates.find((t) => t.id === value)
  const toggleFolder = (id) => setExpandedFolders((e) => ({ ...e, [id]: !e[id] }))
  const pick = (id) => { onChange(id); setOpen(false) }

  const TemplateRow = ({ tpl, indent = 0 }) => (
    <button
      type="button"
      onClick={() => pick(tpl.id)}
      className={`w-full text-left py-2 pr-3 text-sm flex items-center justify-between gap-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
        tpl.id === value ? 'bg-accent-light dark:bg-accent-light text-accent' : 'text-gray-800 dark:text-gray-100'
      }`}
      style={{ paddingLeft: `${12 + indent * 16}px` }}
    >
      <span className="truncate">{tpl.name}</span>
      {tpl.id === value && <Check size={13} className="shrink-0 text-accent" />}
    </button>
  )

  const FolderRow = ({ folder, indent = 0, isSub = false }) => {
    const isOpen = !!expandedFolders[folder.id]
    const own = templatesIn(folder.id)
    const subs = isSub ? [] : subFoldersOf(folder.id)
    return (
      <div>
        <button
          type="button"
          onClick={() => toggleFolder(folder.id)}
          className="w-full text-left py-1.5 pr-3 text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          style={{ paddingLeft: `${12 + indent * 16}px` }}
        >
          {isOpen ? <ChevronDown size={11} className="shrink-0" /> : <ChevronRight size={11} className="shrink-0" />}
          {isOpen ? <FolderOpen size={12} className="shrink-0 text-accent" /> : <Folder size={12} className="shrink-0 text-accent" />}
          <span className="truncate">{folder.name}</span>
        </button>
        {isOpen && (
          <div>
            {own.map((tpl) => <TemplateRow key={tpl.id} tpl={tpl} indent={indent + 1} />)}
            {subs.map((sub) => <FolderRow key={sub.id} folder={sub} indent={indent + 1} isSub />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input flex items-center justify-between gap-2 cursor-pointer w-full text-left"
      >
        <span className={`truncate ${selected ? '' : 'text-gray-400 dark:text-gray-500'}`}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={btnRef} sameWidth>
        <div className="max-h-72 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => pick('')}
            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
              !value ? 'bg-accent-light dark:bg-accent-light text-accent' : 'text-gray-800 dark:text-gray-100'
            }`}
          >
            <span className="truncate">{placeholder}</span>
            {!value && <Check size={13} className="shrink-0 text-accent" />}
          </button>
          {unfiled.map((tpl) => <TemplateRow key={tpl.id} tpl={tpl} />)}
          {topFolders.map((folder) => <FolderRow key={folder.id} folder={folder} />)}
        </div>
      </Popover>
    </div>
  )
}
