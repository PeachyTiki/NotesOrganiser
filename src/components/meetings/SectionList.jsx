import React, { useState, useRef, useEffect, createContext } from 'react'
import { v4 as uuid } from 'uuid'
import {
  GripVertical, Trash2, Plus, AlignLeft, List, BarChart2, GitBranch,
  PieChart, TrendingUp, Pencil, ChevronDown, ChevronUp, CheckSquare, Lightbulb, Brain,
  AlertTriangle, Link, Eye, EyeOff, X,
} from 'lucide-react'

const SEEN_KEY = 'seen_section_types'
const getSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') } catch { return [] } }
const markSeen = (type) => { try { const s = getSeen(); if (!s.includes(type)) localStorage.setItem(SEEN_KEY, JSON.stringify([...s, type])) } catch {} }

const SECTION_HINTS = {
  text:      'A free-form text block — great for raw notes, context, or any content that doesn\'t fit a structured section.',
  notes:     'Rich-text editor for meeting notes. Paste a transcript or write rough notes here, then use the AI overlay (top-right) to clean them up and generate polished, structured output.',
  topics:    'Log discussion topics with a status (Open / In Progress / Closed). Perfect for recurring agendas — open topics can be carried over to the next meeting automatically.',
  graph:     'Bar chart for comparing values — e.g. metrics, scores, or counts. Add categories and values to visualise them instantly.',
  gantt:     'Visual project timeline. Add tasks with start/end dates and track progress percentages. Exports beautifully into PDF exports.',
  pie:       'Pie chart for proportional data — e.g. budget splits or category breakdowns. Add slices with labels and values.',
  line:      'Line chart for trends over time. Add series and x-axis labels to visualise how metrics change across periods.',
  tasks:     'Track action items with assignee, dates, and status (Planned → In Progress → Complete / Blocked). All tasks across every meeting appear on the Tasks page in the top nav.',
  decisions: 'Record formal decisions made during the meeting. Each decision can have an owner and a note for rationale — useful for audit trails.',
  risks:     'Track risks and blockers with severity (Low / Medium / High / Critical), owner, mitigation plan, and status.',
  resources: 'Save links, documents, and references shared during the meeting — all in one place per note.',
}

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
import TasksSection from './sections/TasksSection'
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
  tasks:       { label: 'Tasks',     icon: CheckSquare,   border: 'border-l-green-400',  badge: 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400' },
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
  if (type === 'tasks')       return { ...base, label: '', items: [] }
  if (type === 'decisions')   return { ...base, label: 'Decision Log', items: [] }
  if (type === 'risks')       return { ...base, label: 'Risks & Blockers', items: [] }
  if (type === 'resources')   return { ...base, label: 'Resources & Links', items: [] }
  return base
}

function SectionBody({ section, onChange, t, onOpenTextEditor, isFirstNotesSection }) {
  if (section.type === 'text')        return <TextSection section={section} onChange={onChange} />
  if (section.type === 'notes')       return <NotesSection section={section} onChange={onChange} onOpenTextEditor={onOpenTextEditor} isFirstNotesSection={isFirstNotesSection} />
  if (section.type === 'topics')      return <TopicsSection section={section} onChange={onChange} t={t} />
  if (section.type === 'graph')       return <GraphSection section={section} onChange={onChange} t={t} />
  if (section.type === 'gantt')       return <GanttSection section={section} onChange={onChange} />
  if (section.type === 'pie')         return <PieSection section={section} onChange={onChange} />
  if (section.type === 'line')        return <LineSection section={section} onChange={onChange} />
  if (section.type === 'tasks')       return <TasksSection section={section} onChange={onChange} />
  if (section.type === 'decisions')   return <DecisionSection section={section} onChange={onChange} />
  if (section.type === 'risks')       return <RisksSection section={section} onChange={onChange} />
  if (section.type === 'resources')   return <ResourcesSection section={section} onChange={onChange} />
  return null
}

function SectionCard({ section, onChange, onRemove, t, onOpenTextEditor, collapsed, onToggleCollapse, isOver, isDragging, dragHandleProps, isFirstNotesSection, showHint, onDismissHint }) {
  const meta = TYPE_META[section.type] || TYPE_META.text
  const Icon = meta.icon
  const typeLabel = meta.label === 'Topics' ? t('topics') : meta.label
  const isNotesSection = section.type === 'notes'
  const isTasksSection = section.type === 'tasks'
  const isAlwaysShown = isNotesSection || isTasksSection
  const isEmptyNotes = isNotesSection && !section.content?.trim()
  const isEmptyTasks = isTasksSection && !(section.items?.length > 0)
  const isHidden = section.visible === false

  return (
    <div
      className={`card border-l-4 ${isHidden ? 'border-l-gray-300 dark:border-l-gray-600' : meta.border} overflow-hidden transition-all ${
        isDragging ? 'opacity-30' : (isEmptyNotes || isEmptyTasks) ? 'opacity-60' : ''
      }`}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700 ${isHidden ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
        <button
          {...(dragHandleProps || {})}
          className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing p-0.5 shrink-0 touch-none"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>

        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${isHidden ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500' : meta.badge}`}>
          <Icon size={11} />
          {typeLabel}
        </span>

        <input
          className={`flex-1 bg-transparent text-sm placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none min-w-0 ${isHidden ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}
          value={section.label || ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Section title (optional)"
        />

        {isHidden && (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic shrink-0">hidden from export</span>
        )}

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
          onClick={() => onChange({ visible: !isHidden ? false : undefined })}
          className={`p-1 transition-colors shrink-0 ${isHidden ? 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'}`}
          title={isHidden ? 'Show in export & preview' : 'Hide from export & preview'}
        >
          {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>

        <button
          onClick={onToggleCollapse}
          className="p-1 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors shrink-0"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>

        {!isAlwaysShown && (
          <button
            onClick={() => { if (confirm('Remove this section?')) onRemove() }}
            className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className={`p-3 ${isHidden ? 'opacity-50' : ''}`}>
          {showHint && SECTION_HINTS[section.type] && (
            <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-accent-light dark:bg-accent/10 border border-accent/20 text-xs text-gray-700 dark:text-gray-300">
              <span className="flex-1 leading-relaxed">{SECTION_HINTS[section.type]}</span>
              <button onClick={onDismissHint} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mt-0.5">
                <X size={12} />
              </button>
            </div>
          )}
          <SectionBody section={section} onChange={onChange} t={t} onOpenTextEditor={onOpenTextEditor} isFirstNotesSection={isFirstNotesSection} />
        </div>
      )}
    </div>
  )
}

function SortableSection({ section, onChange, onRemove, t, onOpenTextEditor, collapsed, onToggleCollapse, isOver, isFirstNotesSection, showHint, onDismissHint }) {
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
        isFirstNotesSection={isFirstNotesSection}
        showHint={showHint}
        onDismissHint={onDismissHint}
      />
    </div>
  )
}

export default function SectionList({ sections, onChange, t, note, meetingNotes, defaultTone, contextDepth = 4, openNotesToken = null, tasksEnabled = false }) {
  const [addOpen, setAddOpen] = useState(false)
  const [textEditorFor, setTextEditorFor] = useState(null)
  const [collapsed, setCollapsed] = useState({})
  const [activeId, setActiveId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [hintSectionId, setHintSectionId] = useState(null)
  const collapsedBeforeDrag = useRef(null)

  // Initialize seen section types on first mount so existing sections don't show hints
  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) {
      const existingTypes = [...new Set((sections || []).map((s) => s.type))]
      localStorage.setItem(SEEN_KEY, JSON.stringify(existingTypes))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const update = (id, patch) =>
    onChange(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const remove = (id) => onChange(sections.filter((s) => s.id !== id))

  const toggleCollapse = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))

  const handleDragStart = ({ active }) => {
    setActiveId(active.id)
    collapsedBeforeDrag.current = collapsed
    const allCollapsed = {}
    sections.forEach((s) => { allCollapsed[s.id] = true })
    setCollapsed(allCollapsed)
  }

  const handleDragOver = ({ over }) => setOverId(over?.id || null)

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    setOverId(null)
    setCollapsed(collapsedBeforeDrag.current || {})
    if (!over || active.id === over.id) return
    // Reorder within the full sections array (hidden tasks preserve their position)
    const oldIdx = sections.findIndex((s) => s.id === active.id)
    const newIdx = sections.findIndex((s) => s.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    onChange(arrayMove(sections, oldIdx, newIdx))
  }
  const handleDragCancel = () => {
    setActiveId(null)
    setOverId(null)
    setCollapsed(collapsedBeforeDrag.current || {})
  }

  const addSection = (type) => {
    const section = newSection(type)
    onChange([...sections, section])
    setAddOpen(false)
    if (!getSeen().includes(type)) {
      markSeen(type)
      setHintSectionId(section.id)
    }
  }

  const activeSection = activeId ? sections.find((s) => s.id === activeId) : null
  const textEditorSection = textEditorFor ? sections.find((s) => s.id === textEditorFor) : null

  const firstNotesSectionId = sections.find((s) => s.type === 'notes')?.id
  const visibleSections = sections.filter((s) => s.type !== 'tasks' || tasksEnabled)

  return (
    <SectionContext.Provider value={{ note, meetingNotes, defaultTone, contextDepth, openNotesToken }}>
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={visibleSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {visibleSections.map((section) => (
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
              isFirstNotesSection={section.id === firstNotesSectionId}
              showHint={section.id === hintSectionId}
              onDismissHint={() => setHintSectionId(null)}
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
            {Object.entries(TYPE_META).filter(([type]) => type !== 'tasks' || tasksEnabled).map(([type, meta]) => {
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
