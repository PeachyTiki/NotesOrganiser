const { app, BrowserWindow, shell, ipcMain, Menu, dialog } = require('electron')

const path = require('path')
const fs = require('fs')

const iconPath = path.join(__dirname, '../dist/logo-light.png')
const hasIcon = fs.existsSync(iconPath)

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
