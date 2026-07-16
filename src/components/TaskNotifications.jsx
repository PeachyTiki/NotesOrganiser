import { useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { buildAllTasks } from '../utils/taskUtils'

// Milliseconds until the next occurrence of HH:MM today (or tomorrow, if
// that time already passed today).
function msUntilNextDaily(timeStr) {
  const [h, m] = (timeStr || '09:00').split(':').map(Number)
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

// Milliseconds until the next occurrence of a given weekday (0=Sun..6=Sat) at HH:MM.
function msUntilNextWeekly(dayOfWeek, timeStr) {
  const [h, m] = (timeStr || '09:00').split(':').map(Number)
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
  next.setDate(next.getDate() + ((dayOfWeek - now.getDay() + 7) % 7))
  if (next <= now) next.setDate(next.getDate() + 7)
  return next.getTime() - now.getTime()
}

// Headless — renders nothing. Fires a native OS notification summarising
// open/overdue/due-today tasks on a schedule (per Settings > Task
// Notifications). No UI of its own, so it's mounted once at the top of the
// app rather than inside a specific page.
export default function TaskNotifications() {
  const { meetingNotes, standaloneTasks, settings } = useApp()

  // Read the latest data at fire-time without resetting the timer every
  // time a task changes — only enabled/schedule changes should do that.
  const latest = useRef({ meetingNotes, standaloneTasks, settings })
  latest.current = { meetingNotes, standaloneTasks, settings }

  const tn = settings?.taskNotifications || {}
  const enabled = !!settings?.tasksEnabled && !!tn.enabled
  // Back-compat: a saved frequencyMinutes of 1440 (the old fixed "Once a day"
  // interval, before it became a real wall-clock schedule) is treated as
  // daily-at-09:00 when no explicit mode has been saved yet.
  const mode = tn.mode || (tn.frequencyMinutes === 1440 ? 'daily' : 'interval')
  const frequencyMinutes = tn.frequencyMinutes || 60
  const dailyTime = tn.dailyTime || '09:00'
  const weeklyDay = tn.weeklyDay ?? 1
  const weeklyTime = tn.weeklyTime || '09:00'

  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined') return

    const fire = () => {
      const { meetingNotes, standaloneTasks, settings } = latest.current
      const internalEnabled = !!settings?.internalNotesEnabled
      const tasks = buildAllTasks(meetingNotes, standaloneTasks, internalEnabled)
      const today = new Date().toISOString().slice(0, 10)
      const open = tasks.filter((t) => t.status !== 'complete').length
      const overdue = tasks.filter((t) => t.endDate && t.endDate < today && t.status !== 'complete').length
      const dueToday = tasks.filter((t) => t.endDate === today && t.status !== 'complete').length

      try {
        const notification = new Notification('Notes Organiser — Tasks', {
          body: `${open} open · ${overdue} overdue · ${dueToday} due today`,
        })
        notification.onclick = () => window.focus()
      } catch {
        // Notification API blocked/unavailable in this environment — nothing more to do.
      }
    }

    if (mode === 'interval') {
      const intervalMs = frequencyMinutes * 60 * 1000
      const id = setInterval(fire, intervalMs)
      return () => clearInterval(id)
    }

    // daily/weekly: a self-rescheduling timeout fires at a real wall-clock
    // time instead of drifting from whenever the app happened to start, the
    // way a plain setInterval would.
    let timeoutId
    const scheduleNext = () => {
      const delay = mode === 'weekly' ? msUntilNextWeekly(weeklyDay, weeklyTime) : msUntilNextDaily(dailyTime)
      timeoutId = setTimeout(() => { fire(); scheduleNext() }, delay)
    }
    scheduleNext()
    return () => clearTimeout(timeoutId)
  }, [enabled, mode, frequencyMinutes, dailyTime, weeklyDay, weeklyTime])

  return null
}
