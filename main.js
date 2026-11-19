const path = require('path');
const { app, BrowserWindow, ipcMain, shell, WebContentsView } = require('electron');

// Enable touch-style interactions for device emulation
app.commandLine.appendSwitch('touch-events', 'enabled');

let controlWindow = null;
let displayWindow = null;

// ---------------------------------------------------------------------------
// Device views: one WebContentsView per device panel.
// <webview> cannot be used on this host (guest viewport is stuck at 150px),
// but WebContentsView sizes and renders correctly at full device dimensions.
// ---------------------------------------------------------------------------
const deviceViews = new Map(); // panelId (Number) -> { view, attached, bounds }

const TOUCH_CSS = `::-webkit-scrollbar{width:0!important;height:0!important;display:none!important;background:transparent!important}
html,body{scrollbar-width:none!important;-ms-overflow-style:none!important;overscroll-behavior:contain;}
*{-webkit-tap-highlight-color:rgba(0,0,0,0);}`;

function injectTouchCss(wc) {
  try {
    const p = wc.insertCSS(TOUCH_CSS);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) {}
}

// DevTools-style touch screen: mouse input becomes touch input (taps), so
// pages behave exactly as they do with "Emulate touch screen" in Chrome.
function enableTouchEmulation(wc, attempts) {
  attempts = attempts || 0;
  try {
    if (wc.isDestroyed()) return;
    if (!wc.debugger.isAttached()) {
      if (attempts > 5) return;
      wc.debugger.attach('1.3');
    }
    const send = (method, params) => {
      try {
        const p = wc.debugger.sendCommand(method, params);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (_) {}
    };
    // Both are needed: setEmitTouchEventsForMouse converts mouse input into
    // touch input (taps); setTouchEmulationEnabled makes the page report a
    // touch device (navigator.maxTouchPoints, touch events).
    send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
    send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  } catch (_) {
    if (attempts < 5) setTimeout(() => enableTouchEmulation(wc, attempts + 1), 800);
  }
}

function applyViewZoom(rec) {
  try {
    const wc = rec.view.webContents;
    if (wc.isDestroyed()) return;
    const z = rec.zoomFactor || 1;
    if (Math.abs(wc.getZoomFactor() - z) > 0.0005) wc.setZoomFactor(z);
  } catch (_) {}
}

function sendViewEvent(panelId, type, payload) {
  if (displayWindow && !displayWindow.isDestroyed() && !displayWindow.webContents.isDestroyed()) {
    displayWindow.webContents.send('display:view-event', Object.assign({ panelId, type }, payload || {}));
  }
}

function destroyDeviceView(id) {
  const rec = deviceViews.get(id);
  if (!rec) return;
  deviceViews.delete(id);
  try {
    if (rec.attached && displayWindow && !displayWindow.isDestroyed()) {
      try { displayWindow.contentView.removeChildView(rec.view); } catch (_) {}
    }
  } catch (_) {}
  try { rec.view.webContents.close(); } catch (_) {}
}

function destroyAllDeviceViews() {
  for (const id of Array.from(deviceViews.keys())) destroyDeviceView(id);
}

function createDeviceView(panelId, opts) {
  const id = Number(panelId);
  if (!Number.isFinite(id)) return null;
  if (deviceViews.has(id)) destroyDeviceView(id);
  if (!displayWindow || displayWindow.isDestroyed()) return null;

  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'view-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
      // Each device gets its own session so page zoom, cookies and storage
      // never bleed between panels (host zoom is shared per session+origin).
      partition: 'parade-device-' + id
    }
  });
  const wc = view.webContents;
  const rec = { view, attached: false, bounds: null, zoomFactor: 1 };
  deviceViews.set(id, rec);

  try {
    if (opts && opts.userAgent) wc.setUserAgent(opts.userAgent);
  } catch (_) {}

  // Touch input (like DevTools "Emulate touch screen") + keep it enabled
  // across navigations; re-attach if the debugger session drops.
  enableTouchEmulation(wc);
  try {
    wc.debugger.on('detach', () => {
      if (!wc.isDestroyed()) setTimeout(() => enableTouchEmulation(wc, 0), 600);
    });
  } catch (_) {}

  wc.on('did-start-loading', () => sendViewEvent(id, 'did-start-loading'));
  wc.on('did-stop-loading', () => sendViewEvent(id, 'did-stop-loading'));
  wc.on('did-finish-load', () => { injectTouchCss(wc); applyViewZoom(rec); enableTouchEmulation(wc); sendViewEvent(id, 'did-finish-load'); });
  wc.on('did-navigate', (_e, url) => { injectTouchCss(wc); applyViewZoom(rec); enableTouchEmulation(wc); sendViewEvent(id, 'did-navigate', { url }); });
  wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
    if (isMainFrame) sendViewEvent(id, 'did-navigate-in-page', { url });
  });
  wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    sendViewEvent(id, 'did-fail-load', { errorCode, errorDescription, url: validatedURL });
  });
  wc.on('focus', () => sendViewEvent(id, 'focus'));

  // F12 / Ctrl+Shift+I toggles DevTools for this device view
  wc.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      try { wc.toggleDevTools(); } catch (_) {}
      event.preventDefault();
    }
  });

  try {
    wc.setWindowOpenHandler(({ url }) => {
      // Behave like the old webview allowpopups: let popups open real windows
      try { if (url && /^(https?|file):/i.test(url)) { /* allow electron-managed popup window */ } } catch (_) {}
      return { action: 'allow' };
    });
  } catch (_) {}

  try {
    displayWindow.contentView.addChildView(view);
    rec.attached = true;
    view.setBounds({ x: 0, y: 0, width: 2, height: 2 });
  } catch (_) {
    rec.attached = false;
  }

  return rec;
}

function createControlWindow() {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.focus();
    return controlWindow;
  }
  controlWindow = new BrowserWindow({
    width: 440,
    height: 560,
    minWidth: 360,
    minHeight: 440,
    backgroundColor: '#11141a',
    title: 'Parade',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });
  controlWindow.setMenuBarVisibility(false);
  controlWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      controlWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
  controlWindow.loadFile(path.join(__dirname, 'src', 'control.html'));
  controlWindow.on('closed', () => { controlWindow = null; });
  return controlWindow;
}

function createDisplayWindow() {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.focus();
    return displayWindow;
  }
  displayWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#0b0d11',
    title: 'Parade - Devices',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });
  displayWindow.setMenuBarVisibility(false);
  displayWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      displayWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
  // The renderer is being (re)loaded: drop any orphaned device views.
  displayWindow.webContents.on('did-start-load', () => destroyAllDeviceViews());
  displayWindow.loadFile(path.join(__dirname, 'src', 'display.html'));
  displayWindow.on('closed', () => { destroyAllDeviceViews(); displayWindow = null; });
  return displayWindow;
}

function ensureDisplayWindow() {
  const win = createDisplayWindow();
  return win;
}

function sendToDisplay(channel, payload) {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.webContents.send(channel, payload);
    return true;
  }
  return false;
}

function sendToControl(channel, payload) {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send(channel, payload);
  }
}

ipcMain.handle('display:ensure', () => {
  const win = ensureDisplayWindow();
  if (win) { win.show(); win.focus(); }
  return true;
});

ipcMain.handle('display:focus', () => {
  if (displayWindow && !displayWindow.isDestroyed()) { displayWindow.show(); displayWindow.focus(); return true; }
  return false;
});

ipcMain.on('display:command', (_event, msg) => {
  if (!msg || !msg.type) return;
  const needsWindow = ['add-panel', 'navigate', 'navigate-selected', 'navigate-all', 'clear', 'set-scale', 'remove-selected', 'set-toolbar'];
  if (needsWindow.includes(msg.type)) {
    ensureDisplayWindow();
    const send = () => sendToDisplay('display:command', msg);
    if (displayWindow.webContents.isLoading()) {
      displayWindow.webContents.once('did-finish-load', send);
    } else {
      send();
    }
  } else {
    sendToDisplay('display:command', msg);
  }
});

ipcMain.on('control:state', (_event, state) => {
  sendToControl('control:state', state);
});

// --- Device view IPC -------------------------------------------------------

ipcMain.handle('views:create', (_event, opts) => {
  try {
    const rec = createDeviceView(opts && opts.panelId, opts);
    return !!rec;
  } catch (err) {
    return false;
  }
});

ipcMain.on('views:destroy', (_event, msg) => {
  if (!msg) return;
  destroyDeviceView(Number(msg.panelId));
});

ipcMain.on('views:set-bounds', (_event, msg) => {
  if (!msg || !Array.isArray(msg.items)) return;
  if (!displayWindow || displayWindow.isDestroyed()) return;
  const parent = displayWindow.contentView;
  for (const item of msg.items) {
    const rec = deviceViews.get(Number(item.panelId));
    if (!rec) continue;
    if (!item.bounds) {
      if (rec.attached) {
        try { parent.removeChildView(rec.view); rec.attached = false; } catch (_) {}
      }
      rec.bounds = null;
      continue;
    }
    const b = item.bounds;
    if (!rec.attached) {
      try { parent.addChildView(rec.view); rec.attached = true; } catch (_) { continue; }
    }
    const changed = !rec.bounds || rec.bounds.x !== b.x || rec.bounds.y !== b.y ||
      rec.bounds.width !== b.width || rec.bounds.height !== b.height;
    if (changed) {
      try { rec.view.setBounds(b); rec.bounds = b; } catch (_) {}
    }
  }
});

ipcMain.on('views:navigate', (_event, msg) => {
  if (!msg) return;
  const rec = deviceViews.get(Number(msg.panelId));
  if (!rec || !msg.url) return;
  try { rec.view.webContents.loadURL(msg.url); } catch (_) {}
});

// A horizontal swipe detected inside a device view → forward to the display
// window's screen-to-screen carousel.
ipcMain.on('views:swipe', (_event, msg) => {
  if (!msg || typeof msg.deltaX !== 'number') return;
  sendToDisplay('display:swipe', { deltaX: msg.deltaX });
});

ipcMain.on('views:control', (_event, msg) => {
  if (!msg) return;
  const rec = deviceViews.get(Number(msg.panelId));
  if (!rec) return;
  const wc = rec.view.webContents;
  try {
    switch (msg.action) {
      case 'back':
        if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
        break;
      case 'forward':
        if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
        break;
      case 'reload':
        wc.navigationHistory.reload();
        break;
      case 'devtools':
        if (wc.isDevToolsOpened()) wc.closeDevTools();
        else wc.openDevTools({ mode: 'detach' });
        break;
      case 'set-ua':
        if (msg.data && typeof msg.data.userAgent === 'string') wc.setUserAgent(msg.data.userAgent);
        break;
      case 'set-zoom':
        if (msg.data && typeof msg.data.zoomFactor === 'number' && msg.data.zoomFactor > 0) {
          rec.zoomFactor = msg.data.zoomFactor;
          applyViewZoom(rec);
        }
        break;
      default:
        break;
    }
  } catch (_) {}
});

// Legacy device-emulation handlers (unused by the WebContentsView path)
ipcMain.handle('display:emulate-device', (_event, { webContentsId, params }) => {
  try {
    const wc = require('electron').webContents.fromId(webContentsId);
    if (!wc || wc.isDestroyed()) return false;
    wc.enableDeviceEmulation(params);
    return true;
  } catch (_) {
    return false;
  }
});

ipcMain.handle('display:clear-emulation', (_event, { webContentsId }) => {
  try {
    const wc = require('electron').webContents.fromId(webContentsId);
    if (!wc || wc.isDestroyed()) return false;
    wc.disableDeviceEmulation();
    return true;
  } catch (_) {
    return false;
  }
});

// --- Optional self-test: PARADE_SHOT=/path/out.png --------------------------
// Launches both windows, adds two device panels, captures the display window
// and prints each device view's viewport size, then exits.
if (process.env.PARADE_SHOT) {
  const fs = require('fs');
  const shotPath = process.env.PARADE_SHOT;
  try { app.setPath('userData', '/tmp/opencode/parade-shot-profile'); } catch (_) {}

  app.whenReady().then(() => {
    createControlWindow();
    const win = createDisplayWindow();
    win.setBounds({ x: 0, y: 0, width: 1400, height: 1150 });
    win.webContents.once('did-finish-load', () => {
      win.setTitle('Parade - Devices [TEST]');
      win.webContents.on('console-message', (_e, _level, message) => console.log('DISPLAY_CONSOLE ' + message));
      setTimeout(() => {
        sendToDisplay('display:command', {
          type: 'add-panel',
          panel: { url: 'file://' + path.join(__dirname, 'test.html'), deviceName: 'iPhone 12/13/14', width: 390, height: 844, orientation: 'portrait', uaMode: 'iphone', deviceScaleFactor: 3 }
        });
        sendToDisplay('display:command', {
          type: 'add-panel',
          panel: { url: 'https://example.com', deviceName: 'Pixel 7', width: 412, height: 915, orientation: 'portrait', uaMode: 'android', deviceScaleFactor: 2.625 }
        });
        sendToDisplay('display:command', {
          type: 'add-panel',
          panel: { url: 'file://' + path.join(__dirname, 'test.html'), deviceName: 'Galaxy Z Fold 5 (inner)', width: 768, height: 1076, orientation: 'portrait', uaMode: 'android', deviceScaleFactor: 2.625 }
        });
        sendToDisplay('display:command', {
          type: 'add-panel',
          panel: { url: 'https://example.com', deviceName: 'iPad Pro 12.9"', width: 1024, height: 1366, orientation: 'portrait', uaMode: 'ipad', deviceScaleFactor: 2 }
        });
      }, 400);
      // Simulate a horizontal swipe gesture over the workspace (~400px back).
      setTimeout(() => {
        win.webContents.executeJavaScript(`(function(){
          const ws = document.getElementById('workspace');
          const before = Math.round(ws.scrollLeft);
          ws.dispatchEvent(new WheelEvent('wheel', { deltaX: -400, deltaY: 0, bubbles: true, cancelable: true }));
          return JSON.stringify({ before });
        })()`).then(r => console.log('SWIPE_TEST ' + r)).catch(e => console.log('SWIPE_TEST_ERR ' + e.message));
      }, 6000);
      setTimeout(async () => {
        const sl = await win.webContents.executeJavaScript(`Math.round(document.getElementById('workspace').scrollLeft)`).catch(e => 'ERR:' + e.message);
        console.log('SWIPE_RESULT ' + sl);
      }, 6900);
      // Simulate ArrowRight → should snap to the next screen.
      setTimeout(() => {
        win.webContents.executeJavaScript(`(function(){
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
          return true;
        })()`).catch(() => {});
      }, 7400);
      setTimeout(async () => {
        const sl = await win.webContents.executeJavaScript(`Math.round(document.getElementById('workspace').scrollLeft)`).catch(e => 'ERR:' + e.message);
        console.log('KEY_RESULT ' + sl);
      }, 8300);
      // Simulate a horizontal swipe INSIDE device view 2 (example.com) — the
      // view preload should forward it to the workspace carousel.
      setTimeout(() => {
        const rec2 = deviceViews.get(2);
        if (!rec2) { console.log('VIEW_SWIPE_ERR no view 2'); return; }
        rec2.view.webContents.executeJavaScript(`window.dispatchEvent(new WheelEvent('wheel', { deltaX: -300, deltaY: 0, bubbles: true, cancelable: true })); true;`)
          .then(() => console.log('VIEW_SWIPE_TEST dispatched'))
          .catch(e => console.log('VIEW_SWIPE_ERR ' + e.message));
      }, 8600);
      setTimeout(async () => {
        const sl = await win.webContents.executeJavaScript(`Math.round(document.getElementById('workspace').scrollLeft)`).catch(e => 'ERR:' + e.message);
        console.log('VIEW_SWIPE_RESULT ' + sl);
      }, 9500);
      setTimeout(async () => {
        try {
          const lay = await win.webContents.executeJavaScript(`(function(){
            const ws = document.getElementById('workspace');
            const scales = Array.from(document.querySelectorAll('.panel')).map(p => p.dataset.scale || '?');
            const t = document.getElementById('screenScrollbarThumb');
            const thumb = t ? (getComputedStyle(t).display + ' w=' + t.style.width + ' left=' + t.style.left) : 'missing';
            return JSON.stringify({ wsH: ws.clientHeight, wsW: ws.clientWidth, scrollW: ws.scrollWidth, scales, thumb });
          })()`);
          console.log('LAYOUT ' + lay);
        } catch (e) {
          console.log('LAYOUT_ERR ' + e.message);
        }
        // Touch emulation test: synthesize a real tap through the input
        // pipeline and check the page received a touchstart + indicator.
        try {
          const rec1 = deviceViews.get(1);
          if (rec1) {
            const wc1 = rec1.view.webContents;
            await wc1.executeJavaScript(`window.__paradeTouch = null; window.addEventListener('touchstart', function(e){ window.__paradeTouch = { x: Math.round(e.touches[0].clientX), y: Math.round(e.touches[0].clientY) }; }, { passive: true }); true;`);
            wc1.sendInputEvent({ type: 'mouseDown', x: 80, y: 120, button: 'left', clickCount: 1 });
            wc1.sendInputEvent({ type: 'mouseUp', x: 80, y: 120, button: 'left', clickCount: 1 });
            await new Promise(r => setTimeout(r, 350));
            const t = await wc1.executeJavaScript(`JSON.stringify({ touch: window.__paradeTouch, indicator: !!document.querySelector('[data-parade-touch]') })`);
            console.log('TOUCH_TEST ' + t);
          }
        } catch (err) {
          console.log('TOUCH_TEST_ERR ' + err.message);
        }
        for (const [id, rec] of deviceViews) {
          try {
            const g = await rec.view.webContents.executeJavaScript('({iw:innerWidth, ih:innerHeight, href:location.href, title:document.title})');
            console.log('VIEW_' + id + '=' + JSON.stringify(g) + ' bounds=' + JSON.stringify(rec.bounds) + ' zoom=' + rec.view.webContents.getZoomFactor());
          } catch (err) {
            console.log('VIEW_' + id + '=ERR ' + err.message);
          }
          try {
            const vb = await rec.view.webContents.capturePage();
            const vpath = shotPath.replace(/\.png$/, '') + '-view-' + id + '.png';
            require('fs').writeFileSync(vpath, vb.toPNG());
            console.log('VIEW_SHOT_' + id + ' ' + vpath + ' bytes=' + vb.length);
          } catch (err) {
            console.log('VIEW_SHOT_ERR_' + id + ' ' + err.message);
          }
        }
        try {
          const buf = await win.webContents.capturePage();
          fs.writeFileSync(shotPath, buf.toPNG());
          console.log('SHOT_SAVED ' + shotPath);
        } catch (err) {
          console.log('SHOT_ERR ' + err.message);
        }
        if (process.env.PARADE_KEEP) {
          console.log('KEEPING_APP_ALIVE');
          return; // stay alive for external window capture
        }
        app.quit();
      }, 10000);
    });
  });
} else {
  app.whenReady().then(() => {
    createControlWindow();

    app.on('activate', () => {
      if (!controlWindow || controlWindow.isDestroyed()) createControlWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
