'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('lcApp', {
  isDesktopApp: true,
  speechModel: ipcRenderer.sendSync('lct:speechModelSync'),   // true when the offline speech model is installed
  importSpeechModel: () => ipcRenderer.invoke('lct:importModel'),
  open: (key) => ipcRenderer.invoke('lct:open', key),
  home: () => ipcRenderer.invoke('lct:home'),
  savePdf: () => ipcRenderer.invoke('lct:savePdf'),
  print: () => ipcRenderer.invoke('lct:print'),
  saveResults: (req) => ipcRenderer.invoke('lct:saveResults', req),   // auto-save of results (PDF + HTML + JSON + TXT)
  openResults: (dir) => ipcRenderer.invoke('lct:openResults', dir),
  info: () => ipcRenderer.invoke('lct:info')
});
