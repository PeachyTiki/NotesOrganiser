import { useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { buildAllTasks } from '../utils/taskUtils'

// Headless — renders nothing. Periodically fires a native OS notification
// summarising open/overdue/due-today tasks while the app is running (per
// Settings > Task Notifications). No UI of its own, so it's mounted once at
// the top of the app rather than inside a specific page.
export default function TaskNotifications() {
  const { meetingNotes, standaloneTasks, settings } = useApp()

  // Read the latest data at fire-time without resetting the interval every
  // time a task changes — only enabled/frequency changes should do that.
  const latest = useRef({ meetingNotes, standaloneTasks, settings })
  latest.current = { meetingNotes, standaloneTasks, settings }

  const enabled = !!settings?.tasksEnabled && !!settings?.taskNotifications?.enabled
  const frequencyMinutes = settings?.taskNotifications?.frequencyMinutes || 60

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

    const intervalMs = frequencyMinutes * 60 * 1000
    const id = setInterval(fire, intervalMs)
    return () => clearInterval(id)
  }, [enabled, frequencyMinutes])

  return null
}
