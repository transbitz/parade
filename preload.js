const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('multibrowser', {
  ensureDisplay: () => ipcRenderer.invoke('display:ensure'),
  focusDisplay: () => ipcRenderer.invoke('display:focus'),
  sendCommand: (msg) => ipcRenderer.send('display:command', msg),
  onCommand: (handler) => {
    const listener = (_event, msg) => handler(msg);
    ipcRenderer.on('display:command', listener);
    return () => ipcRenderer.removeListener('display:command', listener);
  },
  sendState: (state) => ipcRenderer.send('control:state', state),
  onState: (handler) => {
    const listener = (_event, state) => handler(state);
    ipcRenderer.on('control:state', listener);
    return () => ipcRenderer.removeListener('control:state', listener);
  },
  emulateDevice: (webContentsId, params) => ipcRenderer.invoke('display:emulate-device', { webContentsId, params }),
  clearDeviceEmulation: (webContentsId) => ipcRenderer.invoke('display:clear-emulation', { webContentsId }),

  // Device views (WebContentsView per panel, managed in the main process)
  viewCreate: (opts) => ipcRenderer.invoke('views:create', opts),
  viewDestroy: (panelId) => ipcRenderer.send('views:destroy', { panelId }),
  viewSetBounds: (items) => ipcRenderer.send('views:set-bounds', { items }),
  viewNavigate: (panelId, url) => ipcRenderer.send('views:navigate', { panelId, url }),
  viewControl: (panelId, action, data) => ipcRenderer.send('views:control', { panelId, action, data }),
  onViewEvent: (handler) => {
    const listener = (_event, msg) => handler(msg);
    ipcRenderer.on('display:view-event', listener);
    return () => ipcRenderer.removeListener('display:view-event', listener);
  },
  onSwipe: (handler) => {
    const listener = (_event, msg) => handler(msg);
    ipcRenderer.on('display:swipe', listener);
    return () => ipcRenderer.removeListener('display:swipe', listener);
  },
});
