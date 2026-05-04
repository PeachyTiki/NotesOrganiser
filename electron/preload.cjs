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
})
