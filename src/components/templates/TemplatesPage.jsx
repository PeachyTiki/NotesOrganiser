import React, { useState } from 'react'
import { Plus, Edit2, Trash2, FileText } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import TemplateEditor from './TemplateEditor'

export default function TemplatesPage() {
  const { templates, deleteTemplate } = useApp()
  const [editing, setEditing] = useState(null) // null | 'new' | templateId

  if (editing !== null) {
    const tpl = editing === 'new' ? null : templates.find((t) => t.id === editing)
    return (
      <TemplateEditor
        template={tpl}
        onClose={() => setEditing(null)}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Templates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Design reusable note layouts with your branding
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setEditing('new')}>
          <Plus size={16} /> New Template
        </button>
      </div>

      {templates.length === 0 ? (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onEdit={() => setEditing(tpl.id)}
              onDelete={() => deleteTemplate(tpl.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateCard({ template, onEdit, onDelete }) {
  return (
    <div className="card overflow-hidden group">
      {/* Banner preview */}
      <div
        className="h-10 w-full"
        style={{ backgroundColor: template.bannerColor || '#E8210A' }}
      />
      {/* Logo preview row */}
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {template.name}
          </h3>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit} className="btn-ghost p-1.5">
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this template?')) onDelete()
              }}
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
