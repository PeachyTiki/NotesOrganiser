import React, { useState, useRef, createContext } from 'react'
import { v4 as uuid } from 'uuid'
import {
  GripVertical, Trash2, Plus, AlignLeft, List, BarChart2, GitBranch,
  PieChart, TrendingUp, Pencil, ChevronDown, ChevronUp, CheckSquare, Lightbulb, Brain,
  AlertTriangle, Link,
} from 'lucide-react'

export const SectionContext = createContext(null)
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import TextSection from './sections/TextSection'
import NotesSection from './sections/NotesSection'
import TopicsSection from './sections/TopicsSection'
import GraphSection from './sections/GraphSection'
import GanttSection from './sections/GanttSection'
import PieSection from './sections/PieSection'
import LineSection from './sections/LineSection'
import ActionItemsSection from './sections/ActionItemsSection'
import DecisionSection from './sections/DecisionSection'
import RisksSection from './sections/RisksSection'
import ResourcesSection from './sections/ResourcesSection'
import TextEditorModal from './TextEditorModal'

const TYPE_META = {
  text:        { label: 'Text',      icon: AlignLeft,   border: 'border-l-sky-400',    badge: 'bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400' },
  notes:       { label: 'Notes',     icon: Brain,       border: 'border-l-purple-400', badge: 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400' },
  topics:      { label: 'Topics',    icon: List,        border: 'border-l-indigo-400', badge: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' },
  graph:       { label: 'Bar',       icon: BarChart2,   border: 'border-l-violet-400', badge: 'bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400' },
  gantt:       { label: 'Gantt',     icon: GitBranch,   border: 'border-l-teal-400',   badge: 'bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400' },
  pie:         { label: 'Pie',       icon: PieChart,    border: 'border-l-orange-400', badge: 'bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400' },
  line:        { label: 'Line',      icon: TrendingUp,  border: 'border-l-emerald-400',badge: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' },
  actionItems: { label: 'Actions',   icon: CheckSquare,   border: 'border-l-green-400',  badge: 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400' },
  decisions:   { label: 'Decisions', icon: Lightbulb,     border: 'border-l-amber-400',  badge: 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400' },
  risks:       { label: 'Risks',     icon: AlertTriangle, border: 'border-l-red-400',    badge: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400' },
  resources:   { label: 'Resources', icon: Link,          border: 'border-l-cyan-400',   badge: 'bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400' },
}

function newSection(type) {
  const base = { id: uuid(), type }
  if (type === 'text')        return { ...base, label: '', content: '' }
  if (type === 'notes')       return { ...base, label: '', content: '' }
  if (type === 'topics')      return { ...base, label: '', items: [] }
  if (type === 'graph')       return { ...base, label: '', data: [], colorMode: 'individual', colorRules: [] }
  if (type === 'gantt')       return { ...base, label: '', data: [], colorMode: 'theme' }
  if (type === 'pie')         return { ...base, label: '', data: [] }
  if (type === 'line')        return { ...base, label: '', xLabels: '', series: [] }
  if (type === 'actionItems') return { ...base, label: 'Action Items', items: [] }
  if (type === 'decisions')   return { ...base, label: 'Decision Log', items: [] }
  if (type === 'risks')       return { ...base, label: 'Risks & Blockers', items: [] }
  if (type === 'resources')   return { ...base, label: 'Resources & Links', items: [] }
  return base
}

function SectionBody({ section, onChange, t, onOpenTextEditor }) {
  if (section.type === 'text')        return <TextSection section={section} onChange={onChange} />
  if (section.type === 'notes')       return <NotesSection section={section} onChange={onChange} onOpenTextEditor={onOpenTextEditor} />
  if (section.type === 'topics')      return <TopicsSection section={section} onChange={onChange} t={t} />
  if (section.type === 'graph')       return <GraphSection section={section} onChange={onChange} t={t} />
  if (section.type === 'gantt')       return <GanttSection section={section} onChange={onChange} />
  if (section.type === 'pie')         return <PieSection section={section} onChange={onChange} />
  if (section.type === 'line')        return <LineSection section={section} onChange={onChange} />
  if (section.type === 'actionItems') return <ActionItemsSection section={section} onChange={onChange} />
  if (section.type === 'decisions')   return <DecisionSection section={section} onChange={onChange} />
  if (section.type === 'risks')       return <RisksSection section={section} onChange={onChange} />
  if (section.type === 'resources')   return <ResourcesSection section={section} onChange={onChange} />
  return null
}

function SectionCard({ section, onChange, onRemove, t, onOpenTextEditor, collapsed, onToggleCollapse, isOver, isDragging, dragHandleProps }) {
  const meta = TYPE_META[section.type] || TYPE_META.text
  const Icon = meta.icon
  const typeLabel = meta.label === 'Topics' ? t('topics') : meta.label

  return (
    <div
      className={`card border-l-4 ${meta.border} overflow-hidden transition-all ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
        <button
          {...(dragHandleProps || {})}
          className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing p-0.5 shrink-0 touch-none"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>

        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${meta.badge}`}>
          <Icon size={11} />
          {typeLabel}
        </span>

        <input
          className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none min-w-0"
          value={section.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Section title (optional)"
        />

        {(section.type === 'text' || section.type === 'notes') && (
          <button
            onClick={onOpenTextEditor}
            className="p-1 text-gray-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors shrink-0"
            title="Open full editor"
          >
            <Pencil size={13} />
          </button>
        )}

        <button
          onClick={onToggleCollapse}
          className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors shrink-0"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>

        <button
          onClick={() => { if (confirm('Remove this section?')) onRemove() }}
          className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="p-3">
          <SectionBody section={section} onChange={onChange} t={t} onOpenTextEditor={onOpenTextEditor} />
        </div>
      )}
    </div>
  )
}

function SortableSection({ section, onChange, onRemove, t, onOpenTextEditor, collapsed, onToggleCollapse, isOver }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <SectionCard
        section={section}
        onChange={onChange}
        onRemove={onRemove}
        t={t}
        onOpenTextEditor={onOpenTextEditor}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        isOver={isOver}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

export default function SectionList({ sections, onChange, t, note, meetingNotes, defaultTone }) {
  const [addOpen, setAddOpen] = useState(false)
  const [textEditorFor, setTextEditorFor] = useState(null)
  const [collapsed, setCollapsed] = useState({})
  const [activeId, setActiveId] = useState(null)
  const [overId, setOverId] = useState(null)
  const collapsedBeforeDrag = useRef(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const update = (id, patch) =>
    onChange(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const remove = (id) => onChange(sections.filter((s) => s.id !== id))

  const toggleCollapse = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))

  const handleDragStart = ({ active }) => {
    setActiveId(active.id)
    // Snapshot current collapsed state, then collapse everything
    collapsedBeforeDrag.current = collapsed
    const allCollapsed = {}
    sections.forEach((s) => { allCollapsed[s.id] = true })
    setCollapsed(allCollapsed)
  }

  const handleDragOver = ({ over }) => setOverId(over?.id || null)

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    setOverId(null)
    // Restore pre-drag collapsed state
    setCollapsed(collapsedBeforeDrag.current || {})
    if (!over || active.id === over.id) return
    const oldIdx = sections.findIndex((s) => s.id === active.id)
    const newIdx = sections.findIndex((s) => s.id === over.id)
    onChange(arrayMove(sections, oldIdx, newIdx))
  }
  const handleDragCancel = () => {
    setActiveId(null)
    setOverId(null)
    setCollapsed(collapsedBeforeDrag.current || {})
  }

  const addSection = (type) => {
    onChange([...sections, newSection(type)])
    setAddOpen(false)
  }

  const activeSection = activeId ? sections.find((s) => s.id === activeId) : null
  const textEditorSection = textEditorFor ? sections.find((s) => s.id === textEditorFor) : null

  return (
    <SectionContext.Provider value={{ note, meetingNotes, defaultTone }}>
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              onChange={(patch) => update(section.id, patch)}
              onRemove={() => remove(section.id)}
              t={t}
              onOpenTextEditor={() => setTextEditorFor(section.id)}
              collapsed={!!collapsed[section.id]}
              onToggleCollapse={() => toggleCollapse(section.id)}
              isOver={overId === section.id && activeId !== section.id}
            />
          ))}
        </SortableContext>

        {/* Floating drag overlay — renders a clean compact card instead of a stretched ghost */}
        <DragOverlay dropAnimation={null}>
          {activeSection ? (
            <div className="shadow-2xl rotate-1 opacity-95">
              <SectionCard
                section={activeSection}
                onChange={() => {}}
                onRemove={() => {}}
                t={t}
                onOpenTextEditor={() => {}}
                collapsed={true}
                onToggleCollapse={() => {}}
                isOver={false}
                isDragging={false}
                dragHandleProps={{}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add section */}
      <div className="relative">
        <button
          onClick={() => setAddOpen((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-400 dark:text-gray-500 hover:border-accent hover:text-accent transition-colors"
        >
          <Plus size={15} /> Add Section
        </button>

        {addOpen && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg z-10 p-2 grid grid-cols-4 gap-2">
            {Object.entries(TYPE_META).map(([type, meta]) => {
              const Icon = meta.icon
              const label = meta.label === 'Topics' ? t('topics') : meta.label
              return (
                <button
                  key={type}
                  onClick={() => addSection(type)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-lg text-xs font-semibold transition-colors hover:opacity-80 ${meta.badge}`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {textEditorSection && (
        <TextEditorModal
          section={textEditorSection}
          onSave={(content) => update(textEditorFor, { content })}
          onClose={() => setTextEditorFor(null)}
        />
      )}
    </div>
    </SectionContext.Provider>
  )
}
