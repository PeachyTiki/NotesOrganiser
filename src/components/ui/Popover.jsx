import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Portal-based floating panel. Renders straight into document.body and
// positions itself with a measured getBoundingClientRect() instead of
// `position: absolute` nested in normal flow — this is what lets it render
// above/in front of *any* sibling, including ones that establish their own
// CSS stacking context (e.g. any element with a backdrop-blur, like the
// `.card` class), which a nested `absolute` + `z-index` can never do.
export default function Popover({ open, onClose, anchorRef, children, className = '', align = 'left', sameWidth = false }) {
  const panelRef = useRef(null)
  const [pos, setPos] = useState(null)

  const measure = () => {
    const trigger = anchorRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const panelH = panelRef.current?.offsetHeight ?? 0
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUpward = panelH > 0 && spaceBelow < panelH + 8 && spaceAbove > spaceBelow
    setPos({
      left: align === 'right' ? null : Math.round(rect.left),
      right: align === 'right' ? Math.round(window.innerWidth - rect.right) : null,
      top: openUpward ? null : Math.round(rect.bottom + 4),
      bottom: openUpward ? Math.round(window.innerHeight - rect.top) + 4 : null,
      width: sameWidth ? Math.round(rect.width) : null,
    })
  }

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    measure()
    // Re-measure once the panel has actually mounted so a too-tall panel near
    // the bottom of the screen can flip upward instead of overflowing.
    const id = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleOutside = (e) => {
      if (anchorRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      onClose()
    }
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    const handleReposition = () => measure()
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose])

  if (!open || !pos) return null

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: pos.top ?? undefined,
        bottom: pos.bottom ?? undefined,
        left: pos.left ?? undefined,
        right: pos.right ?? undefined,
        width: pos.width ?? undefined,
        // Above ordinary page content and the z-50 settings/entity modals
        // dropdowns can live inside, but below the z-60 unsaved-changes
        // modal and the z-100 confirm/alert dialog — a dropdown left open
        // must never outrank an interruption modal stacked on top of it.
        zIndex: 55,
      }}
      className={`dropdown-panel rounded-lg overflow-hidden ${className}`}
    >
      {children}
    </div>,
    document.body
  )
}
