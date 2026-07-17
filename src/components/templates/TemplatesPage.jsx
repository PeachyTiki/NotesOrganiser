import React, { useState } from 'react'
import {
  Plus, Edit2, Trash2, FileText, Folder, FolderOpen, FolderPlus,
  ChevronRight, ChevronDown, GripVertical, Pencil, Check, X,
} from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { useApp } from '../../context/AppContext'
import { useConfirm } from '../ui/DialogProvider'
import TemplateEditor from './TemplateEditor'

const byName = (a, b) => a.name.localeCompare(b.name)

export default function TemplatesPage() {
  const { templates, templateFolders, saveTemplate, deleteTemplate, saveTemplateFolder, deleteTemplateFolder } = useApp()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(null) // null | 'new' | templateId
  const [newTemplateFolderId, setNewTemplateFolderId] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [addingFolder, setAddingFolder] = useState(null) // null | 'root' | parentFolderId
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [activeDragTemplate, setActiveDragTemplate] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  if (editing !== null) {
    const tpl = editing === 'new' ? null : templates.find((t) => t.id === editing)
    return (
      <TemplateEditor
        template={tpl}
        defaultFolderId={newTemplateFolderId}
        onClose={() => { setEditing(null); setNewTemplateFolderId(null) }}
      />
    )
  }

  const folders = templateFolders || []
  const topFolders = folders.filter((f) => !f.parentId).sort(byName)
  const subFoldersOf = (id) => folders.filter((f) => f.parentId === id).sort(byName)
  const templatesIn = (folderId) => templates.filter((t) => (t.folderId || null) === folderId).sort(byName)
  const unfiledTemplates = templatesIn(null)

  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }))

  const startAddFolder = (parentId) => { setAddingFolder(parentId); setNewFolderName('') }
  const submitAddFolder = () => {
    const name = newFolderName.trim()
    if (!name) { setAddingFolder(null); return }
    const parentId = addingFolder === 'root' ? null : addingFolder
    saveTemplateFolder({ id: uuid(), name, parentId, createdAt: new Date().toISOString() })
    if (parentId) setExpanded((e) => ({ ...e, [parentId]: true }))
    setAddingFolder(null)
    setNewFolderName('')
  }

  const startRename = (folder) => { setRenamingFolderId(folder.id); setRenameValue(folder.name) }
  const submitRename = (folder) => {
    const name = renameValue.trim()
    if (name) saveTemplateFolder({ ...folder, name })
    setRenamingFolderId(null)
  }

  const handleDeleteFolder = async (folder) => {
    const subs = subFoldersOf(folder.id)
    const ownCount = templatesIn(folder.id).length
    const subCount = subs.reduce((acc, sf) => acc + templatesIn(sf.id).length, 0)
    const movedCount = ownCount + subCount
    let msg = `Delete folder "${folder.name}"?`
    if (subs.length > 0) msg += ` ${subs.length} subfolder${subs.length !== 1 ? 's' : ''} will also be removed.`
    if (movedCount > 0) msg += ` ${movedCount} template${movedCount !== 1 ? 's' : ''} will move to Unfiled.`
    const ok = await confirm({ message: msg, confirmLabel: 'Delete Folder', danger: true })
    if (ok) deleteTemplateFolder(folder.id)
  }

  const handleDeleteTemplate = async (template) => {
    const ok = await confirm({ message: 'Delete this template?', confirmLabel: 'Delete', danger: true })
    if (ok) deleteTemplate(template.id)
  }

  const handleDragStart = (event) => {
    const templateId = String(event.active.id).replace('tpl:', '')
    setActiveDragTemplate(templates.find((t) => t.id === templateId) || null)
  }

  const handleDragEnd = (event) => {
    setActiveDragTemplate(null)
    const { active, over } = event
    if (!over) return
    const templateId = String(active.id).replace('tpl:', '')
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    const targetFolderId = String(over.id) === 'zone:unfiled' ? null : String(over.id).replace('zone:', '')
    if ((template.folderId || null) === targetFolderId) return
    saveTemplate({ ...template, folderId: targetFolderId })
  }

  const isEmpty = templates.length === 0 && folders.length === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Templates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Design reusable note layouts with your branding. Drag a template into a folder to file it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={() => startAddFolder('root')}>
            <FolderPlus size={16} /> New Folder
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => setEditing('new')}>
            <Plus size={16} /> New Template
          </button>
        </div>
      </div>

      {isEmpty && addingFolder !== 'root' ? (
        <div className="card p-16 text-center">
          <FileText size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No templates yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">
            Create your first template to brand your meeting notes
          </p>
          <button className="btn-primary" onClick={() => setEditing('new')}>
            Create Template
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragTemplate(null)}>
          <div className="space-y-6">
            {/* Unfiled templates */}
            <DropZone id="zone:unfiled" className="rounded-xl">
              {unfiledTemplates.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unfiledTemplates.map((tpl) => (
                    <DraggableTemplateCard
                      key={tpl.id}
                      template={tpl}
                      onEdit={() => setEditing(tpl.id)}
                      onDelete={() => handleDeleteTemplate(tpl)}
                    />
                  ))}
                </div>
              )}
              {unfiledTemplates.length === 0 && folders.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic px-1">
                  Drop a template here to remove it from a folder.
                </p>
              )}
            </DropZone>

            {/* Folder tree */}
            {topFolders.length > 0 && (
              <div className="space-y-2">
                {topFolders.map((folder) => (
                  <FolderSection
                    key={folder.id}
                    folder={folder}
                    ownTemplates={templatesIn(folder.id)}
                    subFolders={subFoldersOf(folder.id)}
                    templatesIn={templatesIn}
                    expanded={!!expanded[folder.id]}
                    onToggle={() => toggle(folder.id)}
                    expandedMap={expanded}
                    onToggleSub={toggle}
                    renamingFolderId={renamingFolderId}
                    renameValue={renameValue}
                    onRenameValueChange={setRenameValue}
                    onStartRename={startRename}
                    onSubmitRename={submitRename}
                    onCancelRename={() => setRenamingFolderId(null)}
                    onDeleteFolder={handleDeleteFolder}
                    onAddSubfolder={() => startAddFolder(folder.id)}
                    addingFolder={addingFolder}
                    newFolderName={newFolderName}
                    onNewFolderNameChange={setNewFolderName}
                    onSubmitAddFolder={submitAddFolder}
                    onCancelAddFolder={() => setAddingFolder(null)}
                    onAddTemplate={(folderId) => { setNewTemplateFolderId(folderId); setEditing('new') }}
                    onEditTemplate={(id) => setEditing(id)}
                    onDeleteTemplate={handleDeleteTemplate}
                  />
                ))}
              </div>
            )}

            {addingFolder === 'root' && (
              <NewFolderInput
                value={newFolderName}
                onChange={setNewFolderName}
                onSubmit={submitAddFolder}
                onCancel={() => setAddingFolder(null)}
              />
            )}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDragTemplate ? (
              <div className="shadow-2xl rotate-1 opacity-95 max-w-xs">
                <TemplateCard template={activeDragTemplate} onEdit={() => {}} onDelete={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

function NewFolderInput({ value, onChange, onSubmit, onCancel }) {
  return (
    <div className="card p-3 flex items-center gap-2">
      <Folder size={15} className="text-gray-400 shrink-0" />
      <input
        autoFocus
        className="input py-1.5 text-sm"
        value={value}
        placeholder="Folder name"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel() }}
      />
      <button className="btn-primary py-1.5 px-3 text-sm" onClick={onSubmit}>Add</button>
      <button className="btn-ghost py-1.5 px-2" onClick={onCancel}><X size={14} /></button>
    </div>
  )
}

function DropZone({ id, children, className = '' }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`transition-colors ${className} ${isOver ? 'ring-2 ring-accent bg-accent-light/40 dark:bg-accent-light/10' : ''}`}
    >
      {children}
    </div>
  )
}

// Top-level folder: holds its own templates plus one level of subfolders.
function FolderSection({
  folder, ownTemplates, subFolders, templatesIn, expanded, onToggle, expandedMap, onToggleSub,
  renamingFolderId, renameValue, onRenameValueChange, onStartRename, onSubmitRename, onCancelRename,
  onDeleteFolder, onAddSubfolder, addingFolder, newFolderName, onNewFolderNameChange, onSubmitAddFolder, onCancelAddFolder,
  onAddTemplate, onEditTemplate, onDeleteTemplate,
}) {
  const totalCount = ownTemplates.length + subFolders.reduce((acc, sf) => acc + templatesIn(sf.id).length, 0)
  const isRenaming = renamingFolderId === folder.id

  return (
    <div className="card overflow-hidden">
      <DropZone id={`zone:${folder.id}`}>
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={onToggle} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          {expanded ? <FolderOpen size={16} className="text-accent shrink-0" /> : <Folder size={16} className="text-accent shrink-0" />}

          {isRenaming ? (
            <input
              autoFocus
              className="input py-1 text-sm flex-1"
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSubmitRename(folder); if (e.key === 'Escape') onCancelRename() }}
            />
          ) : (
            <span className="font-medium text-sm text-gray-900 dark:text-white flex-1 truncate">{folder.name}</span>
          )}

          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{totalCount}</span>

          {isRenaming ? (
            <>
              <button onClick={() => onSubmitRename(folder)} className="p-1 text-green-500 hover:text-green-600 shrink-0"><Check size={14} /></button>
              <button onClick={onCancelRename} className="p-1 text-gray-400 hover:text-gray-600 shrink-0"><X size={14} /></button>
            </>
          ) : (
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => onAddTemplate(folder.id)} title="New template in this folder" className="p-1 text-gray-400 hover:text-accent transition-colors"><Plus size={14} /></button>
              <button onClick={onAddSubfolder} title="New subfolder" className="p-1 text-gray-400 hover:text-accent transition-colors"><FolderPlus size={14} /></button>
              <button onClick={() => onStartRename(folder)} title="Rename" className="p-1 text-gray-400 hover:text-accent transition-colors"><Pencil size={13} /></button>
              <button onClick={() => onDeleteFolder(folder)} title="Delete folder" className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
            </div>
          )}
        </div>
      </DropZone>

      {expanded && (
        <div className="px-4 pb-4 pl-9 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-3">
          {ownTemplates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownTemplates.map((tpl) => (
                <DraggableTemplateCard
                  key={tpl.id}
                  template={tpl}
                  onEdit={() => onEditTemplate(tpl.id)}
                  onDelete={() => onDeleteTemplate(tpl)}
                />
              ))}
            </div>
          )}

          {subFolders.map((sub) => {
            const subTemplates = templatesIn(sub.id)
            const subExpanded = !!expandedMap[sub.id]
            const subRenaming = renamingFolderId === sub.id
            return (
              <div key={sub.id} className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                <DropZone id={`zone:${sub.id}`}>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/60 dark:bg-gray-800/40">
                    <button onClick={() => onToggleSub(sub.id)} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
                      {subExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                    {subExpanded ? <FolderOpen size={14} className="text-accent/80 shrink-0" /> : <Folder size={14} className="text-accent/80 shrink-0" />}
                    {subRenaming ? (
                      <input
                        autoFocus
                        className="input py-0.5 text-xs flex-1"
                        value={renameValue}
                        onChange={(e) => onRenameValueChange(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') onSubmitRename(sub); if (e.key === 'Escape') onCancelRename() }}
                      />
                    ) : (
                      <span className="font-medium text-xs text-gray-700 dark:text-gray-200 flex-1 truncate">{sub.name}</span>
                    )}
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">{subTemplates.length}</span>
                    {subRenaming ? (
                      <>
                        <button onClick={() => onSubmitRename(sub)} className="p-0.5 text-green-500 hover:text-green-600 shrink-0"><Check size={12} /></button>
                        <button onClick={onCancelRename} className="p-0.5 text-gray-400 hover:text-gray-600 shrink-0"><X size={12} /></button>
                      </>
                    ) : (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => onAddTemplate(sub.id)} title="New template in this subfolder" className="p-0.5 text-gray-400 hover:text-accent transition-colors"><Plus size={12} /></button>
                        <button onClick={() => onStartRename(sub)} title="Rename" className="p-0.5 text-gray-400 hover:text-accent transition-colors"><Pencil size={11} /></button>
                        <button onClick={() => onDeleteFolder(sub)} title="Delete subfolder" className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={11} /></button>
                      </div>
                    )}
                  </div>
                </DropZone>
                {subExpanded && subTemplates.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                    {subTemplates.map((tpl) => (
                      <DraggableTemplateCard
                        key={tpl.id}
                        template={tpl}
                        onEdit={() => onEditTemplate(tpl.id)}
                        onDelete={() => onDeleteTemplate(tpl)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {addingFolder === folder.id && (
            <NewFolderInput
              value={newFolderName}
              onChange={onNewFolderNameChange}
              onSubmit={onSubmitAddFolder}
              onCancel={onCancelAddFolder}
            />
          )}
        </div>
      )}
    </div>
  )
}

function DraggableTemplateCard({ template, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tpl:${template.id}` })
  return (
    <div ref={setNodeRef} className={isDragging ? 'opacity-30' : ''}>
      <TemplateCard template={template} onEdit={onEdit} onDelete={onDelete} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

function TemplateCard({ template, onEdit, onDelete, dragHandleProps }) {
  const logoPos = template.logo?.position || 'top-left'
  const logoJustify = logoPos === 'top-right' ? 'flex-end' : logoPos === 'top-center' ? 'center' : 'flex-start'

  return (
    <div className="card overflow-hidden group">
      {/* Banner preview */}
      <div
        className="h-12 w-full flex items-center px-3"
        style={{ backgroundColor: template.bannerColor || '#ff0000' }}
      >
        {template.logo?.show && template.logo?.data
          ? <div className="flex w-full" style={{ justifyContent: logoJustify }}>
              <img src={template.logo.data} alt="Logo" className="h-7 object-contain" />
            </div>
          : <span className="text-white/70 text-xs font-medium">Meeting Notes</span>
        }
      </div>
      {/* Logo preview row */}
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-2 gap-1">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {template.name}
          </h3>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {dragHandleProps && (
              <span {...dragHandleProps} className="btn-ghost p-1.5 cursor-grab active:cursor-grabbing" title="Drag to move between folders">
                <GripVertical size={13} />
              </span>
            )}
            <button onClick={onEdit} className="btn-ghost p-1.5">
              <Edit2 size={13} />
            </button>
            <button
              onClick={onDelete}
              className="btn-ghost p-1.5 text-red-500 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(template.colorPalette || []).slice(0, 5).map((c, i) => (
            <span
              key={i}
              className="w-5 h-5 rounded-full border border-white dark:border-gray-700 shadow-sm"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Font: {template.fontFamily || 'Inter'}
        </p>
      </div>
    </div>
  )
}
