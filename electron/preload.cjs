const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listSpecs: () => ipcRenderer.invoke('specs:list'),
  saveSpec: (spec) => ipcRenderer.invoke('specs:save', spec),
  deleteSpec: (id) => ipcRenderer.invoke('specs:delete', id),
  saveText: (opts) => ipcRenderer.invoke('file:saveText', opts),
  openJson: () => ipcRenderer.invoke('file:openJson'),
});
