const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron')

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

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
