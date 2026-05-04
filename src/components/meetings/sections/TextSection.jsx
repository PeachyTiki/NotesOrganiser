import React from 'react'
import RichTextEditor from './RichTextEditor'

export default function TextSection({ section, onChange }) {
  return (
    <RichTextEditor
      value={section.content || ''}
      onChange={(html) => onChange({ content: html })}
      placeholder="Write notes here… (Ctrl+B bold, Ctrl+I italic, Ctrl+U underline, Tab indent)"
      minHeight={160}
    />
  )
}
