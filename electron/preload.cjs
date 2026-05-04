const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveBackup: (jsonString) => ipcRenderer.invoke('save-backup', jsonString),
  findInPage: (text, forward, findNext) => ipcRenderer.send('find-in-page', text, forward !== false, !!findNext),
  stopFindInPage: () => ipcRenderer.send('stop-find-in-page'),
})
