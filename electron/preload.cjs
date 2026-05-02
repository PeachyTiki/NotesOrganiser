const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveBackup: (jsonString) => ipcRenderer.invoke('save-backup', jsonString),
})
