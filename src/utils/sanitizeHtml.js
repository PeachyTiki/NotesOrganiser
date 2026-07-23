import DOMPurify from 'dompurify'

// Strip anything executable from HTML before it is rendered (innerHTML /
// dangerouslySetInnerHTML) or persisted. Formatting the app produces —
// headings, lists, bold/italic/underline, inline styles, <font>, links,
// data: images — survives; <script>, event handlers (onerror/onload/…),
// javascript: URLs, <iframe>/<object>/<embed>, etc. are removed.
//
// This is the safety net for AI-pasted content: a crafted "AI response" can no
// longer inject an event handler that would run in the renderer and reach the
// exposed electronAPI file-write bridge.
export function sanitizeHtml(html) {
  if (typeof html !== 'string' || !html) return ''
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
}
