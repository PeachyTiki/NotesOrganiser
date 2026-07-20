// Scheduling logic for the user-configured "Scheduled Full Backup" (Settings).
// Backups are anchored to 12:00 local (midday). If the machine was off at the
// scheduled time, the backup is considered due the next time the app is open
// past that point — that's the "catch up when the computer is next on"
// behaviour. All comparisons are done at day/noon granularity so a backup that
// ran a few seconds after noon doesn't push the next one out by a day.

const DAY_MS = 24 * 60 * 60 * 1000

// 12:00 local on the calendar day of `d`.
function noonOf(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
}

// Is a scheduled backup due right now?
//   frequency  — 'daily' | 'weekly' | 'monthly'
//   lastRunAt  — ISO string of the last successful scheduled backup ('' if never)
export function isBackupDue(frequency, lastRunAt, now = new Date()) {
  const todayNoon = noonOf(now)
  // The most recent midday that has already elapsed.
  const nowNoon = now >= todayNoon ? todayNoon : new Date(todayNoon.getTime() - DAY_MS)

  // Never backed up (and a midday has passed) → back up now.
  if (!lastRunAt) return true
  const last = new Date(lastRunAt)
  if (isNaN(last.getTime())) return true

  const lastNoon = noonOf(last)
  const daysSince = Math.round((nowNoon.getTime() - lastNoon.getTime()) / DAY_MS)

  switch (frequency) {
    case 'daily':
      return daysSince >= 1
    case 'weekly':
      return daysSince >= 7
    case 'monthly':
      // Due on the first elapsed midday that falls in a later calendar month.
      return (
        nowNoon.getFullYear() > lastNoon.getFullYear() ||
        (nowNoon.getFullYear() === lastNoon.getFullYear() && nowNoon.getMonth() > lastNoon.getMonth())
      )
    default:
      return false
  }
}

// Dated filename so every run is a point-in-time snapshot the user can restore
// from (rather than a single file that's overwritten).
export function scheduledBackupFilename(now = new Date()) {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `notes_organiser_backup_${yyyy}-${mm}-${dd}.json`
}
