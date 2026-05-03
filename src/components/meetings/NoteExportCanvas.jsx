import React from 'react'
import { BarChart } from './sections/GraphSection'
import { GanttChart, GanttDescriptionTable } from './sections/GanttSection'
import { PieChart } from './sections/PieSection'
import { LineChart } from './sections/LineSection'

const ACTION_STATUS_COLORS = {
  todo:       { bg: '#F1F5F9', text: '#64748B' },
  inProgress: { bg: '#FFFBEB', text: '#D97706' },
  done:       { bg: '#F0FDF4', text: '#16A34A' },
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

const STATUS_COLORS = {
  new: { bg: '#F1F5F9', text: '#64748B' },
  open: { bg: '#EFF6FF', text: '#2563EB' },
  inProgress: { bg: '#FFFBEB', text: '#D97706' },
  complete: { bg: '#F0FDF4', text: '#16A34A' },
}

function renderTextLines(lines, bannerColor) {
  return lines.map((line, i) => {
    if (line.startsWith('## '))
      return <div key={i} style={{ fontSize: 14, fontWeight: 700, color: bannerColor, marginTop: 14, marginBottom: 5 }}>{line.slice(3)}</div>
    if (line.startsWith('# '))
      return <div key={i} style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginTop: 18, marginBottom: 7 }}>{line.slice(2)}</div>
    if (line.startsWith('- [ ] '))
      return <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4, color: '#374151' }}><span>☐</span><span>{line.slice(6)}</span></div>
    if (/^- \[[xX]\] /.test(line))
      return <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4, color: '#94A3B8', textDecoration: 'line-through' }}><span>☑</span><span>{line.slice(6)}</span></div>
    if (line.startsWith('- '))
      return <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 4, color: '#374151' }}><span style={{ color: bannerColor, fontWeight: 700 }}>•</span><span>{line.slice(2)}</span></div>
    if (line === '') return <div key={i} style={{ height: 10 }} />
    return <div key={i} style={{ color: '#374151', marginBottom: 3 }}>{line}</div>
  })
}

function SectionHeader({ label, bannerColor, isFirst }) {
  return (
    <div style={{ marginBottom: 12, marginTop: isFirst ? 0 : 4 }}>
      {!isFirst && (
        <div style={{ height: 1, backgroundColor: '#E2E8F0', marginBottom: label ? 14 : 0 }} />
      )}
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: isFirst ? 0 : 14 }}>
          <div style={{ width: 3, height: 18, backgroundColor: bannerColor, borderRadius: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', letterSpacing: 0.2 }}>{label}</span>
        </div>
      )}
    </div>
  )
}

function SectionBlock({ section, bannerColor, t, isFirst }) {
  // Chart sections get an id so captureChartImages() can find and screenshot them
  const chartId = `chart-section-${section.id}`

  if (section.type === 'text' || section.type === 'notes') {
    const lines = (section.content || '').split('\n')
    if (lines.every(l => l === '') && !section.label) return null
    return (
      <div style={{ marginBottom: 20 }}>
        <SectionHeader label={section.label} bannerColor={bannerColor} isFirst={isFirst} />
        {renderTextLines(lines, bannerColor)}
      </div>
    )
  }

  if (section.type === 'topics') {
    const items = (section.items || []).filter((item) => item.status !== 'complete')
    if (items.length === 0 && !section.label) return null
    return (
      <div style={{ marginBottom: 24 }}>
        <SectionHeader label={section.label || t('topics')} bannerColor={bannerColor} isFirst={isFirst} />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '28%' }}>{t('topic')}</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600 }}>{t('description')}</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '16%' }}>{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const sc = STATUS_COLORS[item.status] || STATUS_COLORS.new
              const statusLabel = item.status === 'inProgress' ? t('inProgress') : t(item.status)
              return (
                <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <td style={{ padding: '7px 8px', color: '#0F172A', fontWeight: 500 }}>{item.topic}</td>
                  <td style={{ padding: '7px 8px', color: '#374151' }}>{item.description}</td>
                  <td style={{ padding: '7px 8px' }}>
                    <span style={{ display: 'inline-block', backgroundColor: sc.bg, color: sc.text, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                      {statusLabel}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (section.type === 'graph') {
    const data = (section.data || []).filter((d) => d.label)
    if (data.length === 0 && !section.label) return null
    return (
      <div id={chartId} style={{ marginBottom: 24 }}>
        <SectionHeader label={section.label || t('chart')} bannerColor={bannerColor} isFirst={isFirst} />
        <BarChart
          data={data}
          bannerColor={bannerColor}
          colorMode={section.colorMode}
          colorRules={section.colorRules}
          width={720}
          compact={false}
        />
      </div>
    )
  }

  if (section.type === 'gantt') {
    const data = (section.data || []).filter((d) => d.label)
    if (data.length === 0 && !section.label) return null
    return (
      <div id={chartId} style={{ marginBottom: 24 }}>
        <SectionHeader label={section.label || 'Gantt'} bannerColor={bannerColor} isFirst={isFirst} />
        <GanttChart data={data} colorMode={section.colorMode} bannerColor={bannerColor} width={720} />
        {section.showDescriptions && (
          <GanttDescriptionTable data={data} bannerColor={bannerColor} />
        )}
      </div>
    )
  }

  if (section.type === 'pie') {
    const data = (section.data || []).filter((d) => d.label)
    if (data.length === 0 && !section.label) return null
    return (
      <div id={chartId} style={{ marginBottom: 24 }}>
        <SectionHeader label={section.label || 'Chart'} bannerColor={bannerColor} isFirst={isFirst} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <PieChart data={data} width={220} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.map((d, i) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: d.color || '#E8210A', display: 'inline-block', flexShrink: 0 }} />
                {d.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (section.type === 'line') {
    const xLabels = (section.xLabels || '').split(',').map((s) => s.trim()).filter(Boolean)
    const series = section.series || []
    if ((xLabels.length === 0 || series.length === 0) && !section.label) return null
    return (
      <div id={chartId} style={{ marginBottom: 24 }}>
        <SectionHeader label={section.label || 'Chart'} bannerColor={bannerColor} isFirst={isFirst} />
        <LineChart xLabels={xLabels} series={series} width={720} />
      </div>
    )
  }

  if (section.type === 'actionItems') {
    const items = (section.items || []).filter((i) => i.task)
    if (items.length === 0 && !section.label) return null
    return (
      <div style={{ marginBottom: 24 }}>
        <SectionHeader label={section.label || 'Action Items'} bannerColor={bannerColor} isFirst={isFirst} />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '36%' }}>Task</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '20%' }}>Assignee</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '18%' }}>Due</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '16%' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const sc = ACTION_STATUS_COLORS[item.status] || ACTION_STATUS_COLORS.todo
              const statusLabel = item.status === 'inProgress' ? 'In Progress' : item.status === 'done' ? 'Done' : 'To do'
              return (
                <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <td style={{ padding: '7px 8px', color: '#0F172A', fontWeight: 500 }}>{item.task}</td>
                  <td style={{ padding: '7px 8px', color: '#374151' }}>{item.assignee}</td>
                  <td style={{ padding: '7px 8px', color: '#374151' }}>{formatDate(item.dueDate)}</td>
                  <td style={{ padding: '7px 8px' }}>
                    <span style={{ display: 'inline-block', backgroundColor: sc.bg, color: sc.text, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                      {statusLabel}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (section.type === 'decisions') {
    const items = (section.items || []).filter((i) => i.decision)
    if (items.length === 0 && !section.label) return null
    return (
      <div style={{ marginBottom: 24 }}>
        <SectionHeader label={section.label || 'Decision Log'} bannerColor={bannerColor} isFirst={isFirst} />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '28%' }}>Decision</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '34%' }}>Rationale</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '20%' }}>Owner</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '18%' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <td style={{ padding: '7px 8px', color: '#0F172A', fontWeight: 500 }}>{item.decision}</td>
                <td style={{ padding: '7px 8px', color: '#374151' }}>{item.rationale}</td>
                <td style={{ padding: '7px 8px', color: '#374151' }}>{item.owner}</td>
                <td style={{ padding: '7px 8px', color: '#374151' }}>{formatDate(item.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (section.type === 'risks') {
    const SEVERITY_COLORS = { low: { bg: '#F0FDF4', text: '#16A34A' }, medium: { bg: '#FFFBEB', text: '#D97706' }, high: { bg: '#FFF7ED', text: '#EA580C' }, critical: { bg: '#FEF2F2', text: '#DC2626' } }
    const items = (section.items || []).filter((i) => i.risk)
    if (items.length === 0 && !section.label) return null
    return (
      <div style={{ marginBottom: 24 }}>
        <SectionHeader label={section.label || 'Risks & Blockers'} bannerColor={bannerColor} isFirst={isFirst} />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '30%' }}>Risk / Blocker</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '14%' }}>Severity</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '18%' }}>Owner</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '24%' }}>Mitigation</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#64748B', fontWeight: 600, width: '14%' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const sc = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.medium
              return (
                <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <td style={{ padding: '7px 8px', color: '#0F172A', fontWeight: 500 }}>{item.risk}</td>
                  <td style={{ padding: '7px 8px' }}>
                    <span style={{ display: 'inline-block', backgroundColor: sc.bg, color: sc.text, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{item.severity || 'medium'}</span>
                  </td>
                  <td style={{ padding: '7px 8px', color: '#374151' }}>{item.owner}</td>
                  <td style={{ padding: '7px 8px', color: '#374151' }}>{item.mitigation}</td>
                  <td style={{ padding: '7px 8px', color: '#374151', textTransform: 'capitalize' }}>{item.status || 'open'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (section.type === 'resources') {
    const items = (section.items || []).filter((i) => i.label || i.url)
    if (items.length === 0 && !section.label) return null
    return (
      <div style={{ marginBottom: 24 }}>
        <SectionHeader label={section.label || 'Resources & Links'} bannerColor={bannerColor} isFirst={isFirst} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: 'flex', gap: 12, fontSize: 13, alignItems: 'flex-start' }}>
              <span style={{ color: bannerColor, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
              <div style={{ minWidth: 0 }}>
                <span style={{ color: '#0F172A', fontWeight: 600 }}>{item.label}</span>
                {item.url && <div style={{ color: '#2563EB', fontSize: 12, wordBreak: 'break-all', marginTop: 1 }}>{item.url}</div>}
                {item.note && <div style={{ color: '#64748B', fontSize: 12, marginTop: 1 }}>{item.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

export default function NoteExportCanvas({ note, template, t }) {
  const bannerColor = template?.bannerColor || '#E8210A'
  const fontFamily = template?.fontFamily || 'Inter'
  const logo = template?.logo
  const dateConfig = template?.dateConfig
  const colorPalette = template?.colorPalette || []

  const showDate = dateConfig?.show !== false
  const dateInHeader = showDate && (dateConfig?.zone === 'header' || !dateConfig?.zone)
  const dateInFooter = showDate && dateConfig?.zone === 'footer'
  const dateAlign = dateConfig?.alignment || 'right'
  const logoPos = logo?.position || 'top-left'

  const d = note.displayOptions || {}
  const showParticipants = d.showParticipants !== false
  const showRoles = d.showRoles !== false
  const showFirms = d.showFirms !== false
  const showEventType = d.showEventType !== false

  const activeParticipants = (note.participants || []).filter((p) => p.enabled !== false && p.name)
  const sections = note.sections || (note.content ? [{ id: '0', type: 'text', label: '', content: note.content }] : [])

  const tFn = t || ((k) => k)

  return (
    <div
      id="note-export-canvas"
      style={{ width: 800, backgroundColor: '#ffffff', fontFamily: fontFamily + ', Inter, sans-serif', fontSize: 13, color: '#1E293B', lineHeight: 1.65 }}
    >
      {/* Banner */}
      <div style={{ backgroundColor: bannerColor, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center' }}>
        {logo?.show && logo?.data ? (
          <div style={{ display: 'flex', width: '100%', justifyContent: logoPos === 'top-right' ? 'flex-end' : logoPos === 'top-center' ? 'center' : 'flex-start' }}>
            <img src={logo.data} alt="Logo" style={{ height: 36, objectFit: 'contain' }} />
          </div>
        ) : (
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{tFn('meetingNotes')}</span>
        )}
      </div>

      {/* Header strip */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>{note.title}</div>
            {(note.customer || (showEventType && note.eventType)) && (
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                {[note.customer, showEventType ? note.eventType : null].filter(Boolean).join(' · ')}
              </div>
            )}
            {note.team && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>{note.team}</div>}
          </div>
          {dateInHeader && (
            <div style={{ fontSize: 13, color: '#64748B', textAlign: dateAlign, marginLeft: 16, whiteSpace: 'nowrap' }}>
              {formatDate(note.date)}
            </div>
          )}
        </div>
      </div>

      {/* Participants */}
      {showParticipants && activeParticipants.length > 0 && (
        <div style={{ padding: '10px 24px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94A3B8', marginBottom: 7 }}>
            {tFn('participants')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {activeParticipants.map((p) => (
              <div key={p.id} style={{ fontSize: 12, color: '#374151', backgroundColor: '#F1F5F9', borderRadius: 4, padding: '3px 10px' }}>
                <strong>{p.name}</strong>
                {showRoles && p.role && <span style={{ color: '#64748B' }}> · {p.role}</span>}
                {showFirms && p.firm && <span style={{ color: '#94A3B8' }}> ({p.firm})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sections body */}
      <div style={{ padding: '20px 24px', minHeight: 360 }}>
        {sections.map((section, idx) => (
          <SectionBlock key={section.id} section={section} bannerColor={bannerColor} t={tFn} isFirst={idx === 0} />
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 24px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {dateInFooter
          ? <div style={{ fontSize: 12, color: '#94A3B8' }}>{formatDate(note.date)}</div>
          : <div />
        }
        <div style={{ fontSize: 11, color: '#CBD5E1' }}>Notes Organiser</div>
      </div>

      {/* Color palette strip */}
      {colorPalette.length > 0 && (
        <div style={{ display: 'flex', height: 4 }}>
          {colorPalette.map((c, i) => <div key={i} style={{ flex: 1, backgroundColor: c }} />)}
        </div>
      )}
    </div>
  )
}
