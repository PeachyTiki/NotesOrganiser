const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveBackup: (jsonString) => ipcRenderer.invoke('save-backup', jsonString),
  findInPage: (text, forward, findNext) => ipcRenderer.send('find-in-page', text, forward !== false, !!findNext),
  stopFindInPage: () => ipcRenderer.send('stop-find-in-page'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  writeFile: (pathParts, filename, base64Data) => ipcRenderer.invoke('write-file', pathParts, filename, base64Data),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  checkPathsExist: (paths) => ipcRenderer.invoke('check-paths-exist', paths),
  moveSyncFolder: (oldDestPath, newDestPath, trackedPaths) => ipcRenderer.invoke('move-sync-folder', oldDestPath, newDestPath, trackedPaths),

  // Floating task widget + note preview popup windows
  openTaskWidget: () => ipcRenderer.send('open-task-widget'),
  openNotePreview: (noteId) => ipcRenderer.send('open-note-preview', noteId),
  closeCurrentWindow: () => ipcRenderer.send('close-current-window'),
  broadcastWidgetState: (state) => ipcRenderer.send('widget-state-broadcast', state),
  getWidgetState: () => ipcRenderer.invoke('widget-get-state'),
  onWidgetStateUpdate: (callback) => {
    const handler = (_event, state) => callback(state)
    ipcRenderer.on('widget-state-update', handler)
    return () => ipcRenderer.removeListener('widget-state-update', handler)
  },
  sendWidgetTaskAction: (action) => ipcRenderer.send('widget-task-action', action),
  onWidgetTaskAction: (callback) => {
    const handler = (_event, action) => callback(action)
    ipcRenderer.on('widget-task-action', handler)
    return () => ipcRenderer.removeListener('widget-task-action', handler)
  },
})
