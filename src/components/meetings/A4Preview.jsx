import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, AlignJustify, BookOpen, ZoomIn, ZoomOut } from 'lucide-react'
import NoteExportCanvas from './NoteExportCanvas'

// A4 at 96 dpi: 794 × 1122 px
const A4_W = 794
const A4_H = 1122
const ZOOM_STEP = 0.15
const ZOOM_MIN = 0.2
const ZOOM_MAX = 3.0

export default function A4Preview({
  note, template, t, isInternal = false,
  hasPrevNote = false, hasNextNote = false,
  onPrevNote, onNextNote, noteNavLabel = '',
  externalZoom,   // when set, overrides internal zoom and hides the zoom controls row
  onZoomChange,   // called with new zoom value when user clicks zoom buttons
}) {
  const containerRef = useRef(null)
  const innerRef = useRef(null)
  const [containerW, setContainerW] = useState(0)
  const [internalZoom, setInternalZoom] = useState(1)
  const isExternalZoom = externalZoom !== undefined
  const zoomFactor = isExternalZoom ? externalZoom : internalZoom
  const applyZoom = (val) => { if (onZoomChange) onZoomChange(val); else setInternalZoom(val) }
  const [innerH, setInnerH] = useState(0)
  const [mode, setMode] = useState('scroll') // 'scroll' | 'flip'
  const [currentPage, setCurrentPage] = useState(1)
  const [jumpVal, setJumpVal] = useState('')
  const [jumpEditing, setJumpEditing] = useState(false)

  // Track container width → auto scale
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Track content height (pre-scale)
  useEffect(() => {
    if (!innerRef.current) return
    const ro = new ResizeObserver((entries) => {
      setInnerH(entries[0].contentRect.height)
    })
    ro.observe(innerRef.current)
    return () => ro.disconnect()
  }, [])

  const autoScale = containerW > 0 ? containerW / A4_W : 1
  const scale = autoScale * zoomFactor
  const docVisualW = A4_W * scale

  const totalPages = Math.max(1, Math.ceil(innerH / A4_H))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)

  // When content changes (note updates), reset to page 1
  useEffect(() => {
    setCurrentPage(1)
  }, [totalPages])

  const goTo = (n) => setCurrentPage(Math.min(Math.max(1, n), totalPages))
  const prev = () => goTo(safePage - 1)
  const next = () => goTo(safePage + 1)

  const handleJumpBlur = () => {
    const n = parseInt(jumpVal)
    if (!isNaN(n)) goTo(n)
    setJumpEditing(false)
    setJumpVal('')
  }

  const handleJumpKey = (e) => {
    if (e.key === 'Enter') { e.target.blur() }
    if (e.key === 'Escape') { setJumpEditing(false); setJumpVal('') }
  }

  // For scroll mode: outer height = all pages scaled; show scrollbar
  // For flip mode: outer height = one page scaled; overflow hidden
  const outerDisplayH = mode === 'flip'
    ? A4_H * scale
    : innerH * scale

  // Page break Y positions in display px (for scroll mode overlay lines)
  const pageBreaks = mode === 'scroll'
    ? Array.from({ length: totalPages - 1 }, (_, i) => (i + 1) * A4_H * scale)
    : []

  // Center document when smaller than container; clip left when zoomed in
  const leftOffset = containerW > 0 && docVisualW < containerW
    ? (containerW - docVisualW) / 2
    : 0

  // Inner transform: for flip, translate to show the current page slice
  const innerTransform = mode === 'flip'
    ? `scale(${scale}) translateY(${-(safePage - 1) * A4_H}px)`
    : `scale(${scale})`

  const zoomPct = Math.round(zoomFactor * 100)
  const showNav = hasPrevNote || hasNextNote || noteNavLabel

  return (
    <div>
      {/* Meeting navigation bar */}
      {showNav && (
        <div className="flex items-center gap-1 mb-1.5 px-1">
          <button
            onClick={onPrevNote}
            disabled={!hasPrevNote}
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors shrink-0"
            title="Older meeting"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="flex-1 text-center text-xs text-gray-500 dark:text-gray-400 truncate select-none">
            {noteNavLabel}
          </span>
          <button
            onClick={onNextNote}
            disabled={!hasNextNote}
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors shrink-0"
            title="Newer meeting"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Controls bar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex-1 min-w-0">
          Document Preview
          {totalPages > 1 && mode === 'scroll' && (
            <span className="ml-2 normal-case font-normal text-gray-400">· {totalPages} pages</span>
          )}
        </p>

        {/* Zoom controls — hidden when parent controls zoom externally */}
        {!isExternalZoom && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => applyZoom(Math.max(ZOOM_MIN, parseFloat((zoomFactor - ZOOM_STEP).toFixed(2))))}
              disabled={zoomFactor <= ZOOM_MIN}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors"
              title="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={() => applyZoom(1)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 w-9 text-center px-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Reset zoom to 100%"
            >
              {zoomPct}%
            </button>
            <button
              onClick={() => applyZoom(Math.min(ZOOM_MAX, parseFloat((zoomFactor + ZOOM_STEP).toFixed(2))))}
              disabled={zoomFactor >= ZOOM_MAX}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 transition-colors"
              title="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex items-center bg-gray-100/60 dark:bg-gray-800/50 backdrop-blur-md rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setMode('scroll')}
            title="Scroll mode"
            className={`p-1.5 rounded-md transition-colors ${mode === 'scroll' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <AlignJustify size={13} />
          </button>
          <button
            onClick={() => setMode('flip')}
            title="Page mode"
            className={`p-1.5 rounded-md transition-colors ${mode === 'flip' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <BookOpen size={13} />
          </button>
        </div>

        {/* Page navigation (flip mode) */}
        {mode === 'flip' && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={prev}
              disabled={safePage <= 1}
              className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>

            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              {jumpEditing ? (
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  className="input text-xs py-0 w-10 text-center"
                  value={jumpVal}
                  onChange={(e) => setJumpVal(e.target.value)}
                  onBlur={handleJumpBlur}
                  onKeyDown={handleJumpKey}
                  autoFocus
                />
              ) : (
                <button
                  className="w-8 text-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 px-1 py-0.5 transition-colors"
                  onClick={() => { setJumpVal(String(safePage)); setJumpEditing(true) }}
                  title="Click to jump to page"
                >
                  {safePage}
                </button>
              )}
              <span>/ {totalPages}</span>
            </div>

            <button
              onClick={next}
              disabled={safePage >= totalPages}
              className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* A4 preview frame */}
      <div
        ref={containerRef}
        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 relative"
        style={{
          height: outerDisplayH,
          overflowY: mode === 'scroll' ? 'auto' : 'hidden',
          overflowX: docVisualW > containerW + 2 ? 'auto' : 'hidden',
          maxHeight: mode === 'scroll' ? '75vh' : undefined,
        }}
      >
        {/* Page break lines (scroll mode) */}
        {pageBreaks.map((breakY, i) => (
          <div
            key={i}
            className="absolute z-10 pointer-events-none"
            style={{ top: breakY - 8, height: 16, left: leftOffset, width: docVisualW }}
          >
            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium select-none">
                Page {i + 2}
              </span>
            </div>
          </div>
        ))}

        {/* Scaled document content */}
        <div
          ref={innerRef}
          style={{
            transform: innerTransform,
            transformOrigin: 'top left',
            width: A4_W,
            position: 'absolute',
            top: 0,
            left: leftOffset,
            backgroundColor: '#ffffff',
          }}
        >
          <NoteExportCanvas note={note} template={template} t={t} isInternal={isInternal} />
        </div>
      </div>

      {/* Flip mode: clickable page indicator dots (up to 12 pages) */}
      {mode === 'flip' && totalPages > 1 && totalPages <= 12 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => goTo(i + 1)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i + 1 === safePage ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
