const { app, BrowserWindow, shell, ipcMain, Menu, dialog } = require('electron')

const path = require('path')
const fs = require('fs')

const iconPath = path.join(__dirname, '../dist/logo-light.png')
const hasIcon = fs.existsSync(iconPath)

// The primary application window. Floating popup windows relay task
// actions back to this one, since it's the only window holding real state.
let mainWin = null

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 640,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    title: 'Notes Organiser',
    backgroundColor: '#f9fafb',
    show: false,
    ...(hasIcon ? { icon: iconPath } : {}),
  })

  mainWin = win
  win.on('closed', () => { if (mainWin === win) mainWin = null })

  win.loadFile(path.join(__dirname, '../dist/index.html'))
  win.once('ready-to-show', () => win.show())

  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
    ]))
  } else {
    win.setMenuBarVisibility(false)
    Menu.setApplicationMenu(null)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
}

// ── Floating popup windows (task widget + note preview) ──────────────────────
// Frameless, always-on-top windows that load the same bundle with a
// `?widget=` query flag so main.jsx mounts a lightweight widget component
// instead of the full app. They carry no state of their own — see the
// state-relay IPC below.

const popupWins = new Set()
let taskWidgetWin = null
let notePreviewWin = null
let latestAppState = null

// Encodes the current theme into the popup's query string (so it can apply
// dark/accent on its very first paint) and picks a matching window
// backgroundColor (so there's no flash of white before any HTML paints).
function themeQuery(themeInfo) {
  if (!themeInfo) return {}
  return {
    dark: themeInfo.darkMode ? '1' : '0',
    accentLight: themeInfo.accentLight || '',
    accentDark: themeInfo.accentDark || '',
  }
}

function createPopupWindow(query, size, themeInfo) {
  const win = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: size.minWidth,
    minHeight: size.minHeight,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    fullscreenable: false,
    backgroundColor: themeInfo?.darkMode ? '#030712' : '#f9fafb',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    ...(hasIcon ? { icon: iconPath } : {}),
  })

  win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { ...query, ...themeQuery(themeInfo) } })
  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  popupWins.add(win)
  win.on('closed', () => popupWins.delete(win))
  return win
}

ipcMain.on('open-task-widget', (_event, themeInfo) => {
  if (taskWidgetWin && !taskWidgetWin.isDestroyed()) {
    taskWidgetWin.show()
    taskWidgetWin.focus()
    return
  }
  taskWidgetWin = createPopupWindow({ widget: 'tasks' }, { width: 340, height: 560, minWidth: 300, minHeight: 320 }, themeInfo)
  taskWidgetWin.on('closed', () => { taskWidgetWin = null })
})

ipcMain.on('open-note-preview', (_event, noteId, themeInfo) => {
  if (notePreviewWin && !notePreviewWin.isDestroyed()) notePreviewWin.close()
  notePreviewWin = createPopupWindow(
    { widget: 'notePreview', noteId: String(noteId || '') },
    { width: 760, height: 820, minWidth: 420, minHeight: 400 },
    themeInfo
  )
  notePreviewWin.on('closed', () => { notePreviewWin = null })
})

ipcMain.on('close-current-window', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close()
})

// ── Cross-window state relay ─────────────────────────────────────────────────
// The main window pushes its full state here on every change; popup windows
// pull the latest snapshot on open and then receive live pushes.
ipcMain.on('widget-state-broadcast', (event, state) => {
  latestAppState = state
  for (const win of popupWins) {
    if (win.isDestroyed() || win.webContents === event.sender) continue
    win.webContents.send('widget-state-update', state)
  }
})

ipcMain.handle('widget-get-state', () => latestAppState)

// Popup windows have no state of their own — task actions (e.g. marking a
// task complete) get relayed to the main window, which actually applies them.
ipcMain.on('widget-task-action', (_event, action) => {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('widget-task-action', action)
  }
})

// ── Find-in-page IPC ─────────────────────────────────────────────────────────
ipcMain.on('find-in-page', (event, text, forward, findNext) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || !text) return
  win.webContents.findInPage(text, { forward: forward !== false, findNext: !!findNext })
})
ipcMain.on('stop-find-in-page', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return
  win.webContents.stopFindInPage('clearSelection')
})

// ── Backup IPC ────────────────────────────────────────────────────────────────
ipcMain.handle('save-backup', async (_event, jsonString) => {
  const docsPath = app.getPath('documents')
  const backupDir = path.join(docsPath, 'Notes Organiser', 'Backups')
  fs.mkdirSync(backupDir, { recursive: true })

  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  const dateStr = `${dd}.${mm}.${yyyy}`

  let filename = `notes_organiser_backup_${dateStr}.json`
  let filepath = path.join(backupDir, filename)
  let v = 2
  while (fs.existsSync(filepath)) {
    filename = `notes_organiser_backup_${dateStr}_v${v}.json`
    filepath = path.join(backupDir, filename)
    v++
  }

  fs.writeFileSync(filepath, jsonString, 'utf8')
  return { filename, folder: backupDir }
})

// ── Folder Sync IPC ───────────────────────────────────────────────────────────

ipcMain.handle('select-folder', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Sync Destination Folder',
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('write-file', async (_event, pathParts, filename, base64Data) => {
  try {
    const dir = path.join(...pathParts)
    fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, filename)
    const buffer = Buffer.from(base64Data, 'base64')
    fs.writeFileSync(filePath, buffer)
    return { ok: true, filePath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('delete-file', async (_event, filePath) => {
  try {
    fs.unlinkSync(filePath)
  } catch (err) {
    if (err.code !== 'ENOENT') return { ok: false, error: err.message }
  }
  return { ok: true }
})

ipcMain.handle('check-paths-exist', async (_event, paths) => {
  const results = {}
  for (const p of (paths || [])) {
    try { results[p] = fs.existsSync(p) && fs.statSync(p).isDirectory() }
    catch { results[p] = false }
  }
  return results
})

ipcMain.handle('move-sync-folder', async (_event, oldDestPath, newDestPath, trackedPaths) => {
  const isWin = process.platform === 'win32'
  const normOld = path.normalize(oldDestPath)
  const normNew = path.normalize(newDestPath)
  const results = []
  for (const rawPath of (trackedPaths || [])) {
    const normPath = path.normalize(rawPath)
    try {
      if (!fs.existsSync(normPath)) {
        results.push({ oldPath: rawPath, ok: false, reason: 'not_found' })
        continue
      }
      const pathCmp = isWin ? normPath.toLowerCase() : normPath
      const destCmp = isWin ? normOld.toLowerCase() : normOld
      if (!pathCmp.startsWith(destCmp)) {
        results.push({ oldPath: rawPath, ok: false, reason: 'path_mismatch' })
        continue
      }
      const rel = normPath.slice(normOld.length)
      const newPath = path.join(normNew, rel)
      fs.mkdirSync(path.dirname(newPath), { recursive: true })
      try {
        fs.renameSync(normPath, newPath)
      } catch {
        // Cross-device: fall back to copy + delete
        fs.copyFileSync(normPath, newPath)
        try { fs.unlinkSync(normPath) } catch {}
      }
      results.push({ oldPath: rawPath, newPath, ok: true })
    } catch (err) {
      results.push({ oldPath: rawPath, ok: false, reason: err.message })
    }
  }
  return results
})

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
