import React from 'react'

export default function TextSection({ section, onChange }) {
  return (
    <textarea
      className="input resize-none text-sm leading-relaxed min-h-40 w-full"
      value={section.content || ''}
      onChange={(e) => onChange({ content: e.target.value })}
      placeholder={`Write notes here…\n\nUse ## for headings, - for bullets, - [ ] for action items.`}
    />
  )
}
