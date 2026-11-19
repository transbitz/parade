(function () {
  const STORAGE_KEY = 'multibrowser.state.v3';

  const USER_AGENTS = {
    default: '',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  };

  const DEVICE_PRESETS = [
    { group: 'Phones', name: 'iPhone SE (3rd)', width: 375, height: 667 },
    { group: 'Phones', name: 'iPhone 12/13/14', width: 390, height: 844 },
    { group: 'Phones', name: 'iPhone 14/15 Pro', width: 393, height: 852 },
    { group: 'Phones', name: 'iPhone 14/15 Pro Max', width: 430, height: 932 },
    { group: 'Phones', name: 'Pixel 7', width: 412, height: 915 },
    { group: 'Phones', name: 'Pixel 7 Pro', width: 412, height: 892 },
    { group: 'Phones', name: 'Samsung Galaxy S20', width: 360, height: 800 },
    { group: 'Phones', name: 'Samsung Galaxy S23', width: 360, height: 780 },

    { group: 'Flip phones', name: 'Galaxy Z Flip 5 (inner)', width: 412, height: 1004 },
    { group: 'Flip phones', name: 'Galaxy Z Flip 5 (cover)', width: 360, height: 748 },
    { group: 'Flip phones', name: 'Galaxy Z Flip 6 (inner)', width: 412, height: 1004 },
    { group: 'Flip phones', name: 'Galaxy Z Flip 6 (cover)', width: 360, height: 748 },
    { group: 'Flip phones', name: 'Motorola Razr+ (inner)', width: 412, height: 1080 },
    { group: 'Flip phones', name: 'Motorola Razr+ (cover)', width: 360, height: 800 },

    { group: 'Foldables', name: 'Galaxy Z Fold 5 (inner)', width: 768, height: 1076 },
    { group: 'Foldables', name: 'Galaxy Z Fold 5 (cover)', width: 373, height: 819 },
    { group: 'Foldables', name: 'Galaxy Z Fold 6 (inner)', width: 768, height: 1076 },
    { group: 'Foldables', name: 'Galaxy Z Fold 6 (cover)', width: 374, height: 832 },
    { group: 'Foldables', name: 'Pixel Fold (inner)', width: 841, height: 701 },
    { group: 'Foldables', name: 'Pixel Fold (cover)', width: 412, height: 892 },
    { group: 'Foldables', name: 'OnePlus Open (inner)', width: 857, height: 800 },
    { group: 'Foldables', name: 'OnePlus Open (cover)', width: 387, height: 804 },
    { group: 'Foldables', name: 'Surface Duo (single)', width: 360, height: 720 },
    { group: 'Foldables', name: 'Surface Duo (dual)', width: 720, height: 720 },

    { group: 'Tablets', name: 'iPad Mini', width: 768, height: 1024 },
    { group: 'Tablets', name: 'iPad Air', width: 820, height: 1180 },
    { group: 'Tablets', name: 'iPad Pro 11"', width: 834, height: 1194 },
    { group: 'Tablets', name: 'iPad Pro 12.9"', width: 1024, height: 1366 },
    { group: 'Tablets', name: 'Pixel Tablet', width: 800, height: 1280 },

    { group: 'Custom', name: 'Custom size', width: null, height: null, custom: true },
  ];

  const toolbar = document.getElementById('toolbar');
  const showBarBtn = document.getElementById('showBarBtn');
  const toggleBarBtn = document.getElementById('toggleBarBtn');
  const urlInput = document.getElementById('urlInput');
  const deviceSelect = document.getElementById('deviceSelect');
  const customSizeGroup = document.getElementById('customSizeGroup');
  const customWidth = document.getElementById('customWidth');
  const customHeight = document.getElementById('customHeight');
  const orientationSelect = document.getElementById('orientationSelect');
  const uaSelect = document.getElementById('uaSelect');
  const scaleSelect = document.getElementById('scaleSelect');
  const addPanelBtn = document.getElementById('addPanelBtn');
  const goSelectedBtn = document.getElementById('goSelectedBtn');
  const navigateAllBtn = document.getElementById('navigateAllBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const workspace = document.getElementById('workspace');
  const emptyState = document.getElementById('emptyState');
  const panelTemplate = document.getElementById('panelTemplate');

  let panelCounter = 0;
  let saveTimer = null;
  let selectedPanelId = null;

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 250);
  }

  function getPanels() {
    return Array.from(workspace.querySelectorAll('.panel'));
  }

  function getSelectedPanel() {
    if (!selectedPanelId) return null;
    return getPanels().find(p => p.dataset.panelId === selectedPanelId) || null;
  }

  function setSelectedPanel(panel) {
    getPanels().forEach(p => p.classList.toggle('selected', p === panel));
    selectedPanelId = panel ? panel.dataset.panelId : null;
  }

  function saveState() {
    try {
      const panels = getPanels().map((panel) => {
        const s = panel.__mbState;
        if (!s) return null;
        return {
          url: s.url,
          homeUrl: s.homeUrl,
          deviceName: s.deviceName,
          width: s.width,
          height: s.height,
          orientation: s.orientation,
          uaMode: s.uaMode || 'default',
        };
      }).filter(Boolean);

      const data = {
        version: 3,
        toolbarCollapsed: toolbar.classList.contains('collapsed'),
        urlInput: urlInput.value || '',
        deviceSelect: deviceSelect.value || '',
        customWidth: customWidth.value || '390',
        customHeight: customHeight.value || '844',
        orientation: orientationSelect.value || 'portrait',
        uaMode: uaSelect.value || 'default',
        scale: scaleSelect.value || '0.5',
        panels,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function populateDevices() {
    const groups = new Map();
    for (const d of DEVICE_PRESETS) {
      if (!groups.has(d.group)) groups.set(d.group, []);
      groups.get(d.group).push(d);
    }
    for (const [groupName, devices] of groups.entries()) {
      const og = document.createElement('optgroup');
      og.label = groupName;
      devices.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d.name;
        opt.textContent = d.name;
        og.appendChild(opt);
      });
      deviceSelect.appendChild(og);
    }
    if ([...deviceSelect.options].some(o => o.value === 'iPhone 14/15 Pro')) {
      deviceSelect.value = 'iPhone 14/15 Pro';
    }
    updateCustomVisibility();
  }

  function populatePanelDeviceSelect(selectEl) {
    const groups = new Map();
    for (const d of DEVICE_PRESETS) {
      if (d.custom) continue;
      if (!groups.has(d.group)) groups.set(d.group, []);
      groups.get(d.group).push(d);
    }
    for (const [groupName, devices] of groups.entries()) {
      const og = document.createElement('optgroup');
      og.label = groupName;
      devices.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d.name;
        opt.textContent = d.name;
        og.appendChild(opt);
      });
      selectEl.appendChild(og);
    }
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = 'Custom size';
    selectEl.appendChild(customOpt);
  }

  function getSelectedDevice() {
    return DEVICE_PRESETS.find(d => d.name === deviceSelect.value) || DEVICE_PRESETS[0];
  }
  function findPreset(name) { return DEVICE_PRESETS.find(d => d.name === name); }
  function updateCustomVisibility() { customSizeGroup.classList.toggle('hidden', !getSelectedDevice().custom); }

  function normalizeUrl(raw) {
    let url = (raw || '').trim();
    if (!url) return 'about:blank';
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
      if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/.*)?$/i.test(url)) url = 'http://' + url;
      else url = 'https://' + url;
    }
    return url;
  }

  function getNumericScale() {
    const v = scaleSelect.value;
    if (v === 'fit') return computeFitScale();
    const s = parseFloat(v);
    return Number.isFinite(s) && s > 0 ? s : 0.5;
  }

  function computeFitScale() {
    const panels = getPanels();
    if (panels.length === 0) return 0.5;
    const style = getComputedStyle(workspace);
    const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const availH = Math.max(100, workspace.clientHeight - padY - 4);
    let minScale = 1;
    for (const p of panels) {
      const h = parseInt(p.dataset.height, 10) || 800;
      minScale = Math.min(minScale, availH / h);
    }
    minScale = Math.max(0.1, Math.min(1, minScale));
    return minScale;
  }

  function getTargetSize(device, orientation) {
    let w, h;
    if (device.custom) {
      w = parseInt(customWidth.value, 10) || 390;
      h = parseInt(customHeight.value, 10) || 844;
    } else {
      w = device.width; h = device.height;
    }
    w = Math.max(200, Math.min(3000, w));
    h = Math.max(200, Math.min(3000, h));
    if (orientation === 'landscape') return { width: h, height: w };
    return { width: w, height: h };
  }

  function applyLayout(panel) {
    const s = panel.__mbState;
    const sizer = panel.querySelector('.panel-sizer');
    const wrap = panel.querySelector('.panel-screen-wrap');
    if (!s || !sizer || !wrap) return;
    const scale = getNumericScale();
    const w = s.width, h = s.height;
    panel.dataset.width = String(w);
    panel.dataset.height = String(h);
    sizer.style.width = Math.round(w * scale) + 'px';
    sizer.style.height = Math.round(h * scale) + 'px';
    wrap.style.width = w + 'px';
    wrap.style.height = h + 'px';
    wrap.style.transform = `scale(${scale})`;
  }

  function relayoutAll() {
    getPanels().forEach(applyLayout);
  }

  function updateEmptyState() {
    emptyState.style.display = getPanels().length ? 'none' : '';
  }

  function setPanelStatus(panel, type, text) {
    const el = panel.querySelector('.panel-status-text');
    if (!el) return;
    el.classList.remove('error', 'loading');
    if (type) el.classList.add(type);
    el.textContent = text || '';
    el.title = text || '';
  }

  function uaString(mode) { return USER_AGENTS[mode] || ''; }

  function applyUserAgent(webview, mode) {
    const ua = uaString(mode);
    try {
      if (typeof webview.setUserAgent === 'function') webview.setUserAgent(ua);
      else if (ua) webview.setAttribute('useragent', ua);
      else webview.removeAttribute('useragent');
    } catch (_) {
      try { if (ua) webview.setAttribute('useragent', ua); else webview.removeAttribute('useragent'); } catch (_) {}
    }
  }

  function injectTouchStyle(webview) {
    const css = `::-webkit-scrollbar{width:0!important;height:0!important;display:none!important;background:transparent!important}
html,body{scrollbar-width:none!important;-ms-overflow-style:none!important;overscroll-behavior:contain;}
*{-webkit-tap-highlight-color:rgba(0,0,0,0);}`;
    try {
      const p = webview.insertCSS(css);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
  }

  function navigatePanel(panel, nextUrl) {
    const s = panel.__mbState;
    const webview = panel.querySelector('.device-screen');
    const urlField = panel.querySelector('.panel-url');
    if (!s || !webview) return;
    s.url = normalizeUrl(nextUrl);
    if (urlField) urlField.value = s.url;
    setPanelStatus(panel, 'loading', 'Loading…');
    applyUserAgent(webview, s.uaMode);
    try {
      if (typeof webview.loadURL === 'function') webview.loadURL(s.url);
      else webview.setAttribute('src', s.url);
    } catch (_) {
      webview.setAttribute('src', s.url);
    }
    scheduleSave();
  }

  function createPanel(config, opts = {}) {
    panelCounter += 1;
    const fragment = panelTemplate.content.cloneNode(true);
    const panel = fragment.querySelector('.panel');
    const webview = panel.querySelector('.device-screen');
    const toggleBtn = panel.querySelector('.panel-toggle');
    const overlay = panel.querySelector('.panel-overlay');
    const hideControlsBtn = panel.querySelector('.hide-controls-btn');
    const nameEl = panel.querySelector('.panel-device-name');
    const dimsEl = panel.querySelector('.panel-dims');
    const urlField = panel.querySelector('.panel-url');
    const goBtn = panel.querySelector('.panel-go-btn');
    const deviceSel = panel.querySelector('.panel-device-select');
    const backBtn = panel.querySelector('.back-btn');
    const forwardBtn = panel.querySelector('.forward-btn');
    const reloadBtn = panel.querySelector('.reload-btn');
    const rotateBtn = panel.querySelector('.rotate-btn');
    const devtoolsBtn = panel.querySelector('.devtools-btn');
    const duplicateBtn = panel.querySelector('.duplicate-btn');
    const closeBtn = panel.querySelector('.close-btn');

    populatePanelDeviceSelect(deviceSel);

    const normalizedUrl = normalizeUrl(config.url);
    const state = {
      id: panelCounter,
      url: normalizedUrl,
      homeUrl: normalizeUrl(config.homeUrl || normalizedUrl),
      deviceName: config.deviceName || 'Custom',
      width: Math.max(200, Math.min(3000, parseInt(config.width, 10) || 390)),
      height: Math.max(200, Math.min(3000, parseInt(config.height, 10) || 844)),
      orientation: config.orientation === 'landscape' ? 'landscape' : 'portrait',
      uaMode: config.uaMode || 'default',
    };
    panel.__mbState = state;
    panel.dataset.panelId = String(state.id);

    function renderInfo() {
      nameEl.textContent = state.deviceName;
      dimsEl.textContent = `${state.width}×${state.height}`;
      const preset = findPreset(state.deviceName);
      deviceSel.value = (preset && !preset.custom) ? state.deviceName : '__custom__';
      if (urlField && document.activeElement !== urlField) urlField.value = state.url;
      applyLayout(panel);
    }

    const openControls = () => { panel.classList.add('controls-open'); setSelectedPanel(panel); setTimeout(() => { try { urlField.focus(); urlField.select(); } catch (_) {} }, 0); };
    const closeControls = () => { panel.classList.remove('controls-open'); };

    panel.addEventListener('mousedown', (e) => {
      setSelectedPanel(panel);
    });
    panel.addEventListener('focusin', () => setSelectedPanel(panel));

    toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); if (panel.classList.contains('controls-open')) closeControls(); else openControls(); });
    hideControlsBtn.addEventListener('click', (e) => { e.stopPropagation(); closeControls(); });
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) { e.stopPropagation(); closeControls(); }
    });

    backBtn.addEventListener('click', (e) => { e.stopPropagation(); try { if (webview.canGoBack && webview.canGoBack()) webview.goBack(); } catch (_) {} });
    forwardBtn.addEventListener('click', (e) => { e.stopPropagation(); try { if (webview.canGoForward && webview.canGoForward()) webview.goForward(); } catch (_) {} });
    reloadBtn.addEventListener('click', (e) => { e.stopPropagation(); try { webview.reload ? webview.reload() : navigatePanel(panel, state.url); } catch (_) { navigatePanel(panel, state.url); } });
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = state.width; state.width = state.height; state.height = t;
      state.orientation = state.orientation === 'portrait' ? 'landscape' : 'portrait';
      renderInfo(); relayoutAll(); scheduleSave();
    });
    devtoolsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      try {
        if (webview.isDevToolsOpened && webview.isDevToolsOpened()) webview.closeDevTools();
        else webview.openDevTools && webview.openDevTools();
      } catch (_) {}
    });
    duplicateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      createPanel({ ...state, url: state.url, homeUrl: state.homeUrl }, { scroll: true });
      scheduleSave();
    });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasSelected = selectedPanelId === panel.dataset.panelId;
      panel.remove();
      if (wasSelected) selectedPanelId = null;
      updateEmptyState();
      relayoutAll();
      scheduleSave();
    });

    deviceSel.addEventListener('change', (e) => {
      e.stopPropagation();
      const val = deviceSel.value;
      if (val === '__custom__') {
        state.deviceName = 'Custom';
      } else {
        const preset = findPreset(val);
        if (preset && !preset.custom) {
          let w = preset.width, h = preset.height;
          if (state.orientation === 'landscape') { const tmp = w; w = h; h = tmp; }
          state.deviceName = preset.name;
          state.width = w; state.height = h;
        }
      }
      renderInfo(); relayoutAll(); scheduleSave();
    });

    goBtn.addEventListener('click', (e) => { e.stopPropagation(); navigatePanel(panel, urlField.value); closeControls(); });
    urlField.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); navigatePanel(panel, urlField.value); closeControls(); } });
    urlField.addEventListener('mousedown', (e) => e.stopPropagation());
    deviceSel.addEventListener('mousedown', (e) => e.stopPropagation());
    deviceSel.addEventListener('change', (e) => e.stopPropagation()); // selection handled below but ensure no bubble issues
    toggleBtn.addEventListener('mousedown', (e) => e.stopPropagation());

    webview.addEventListener('dom-ready', () => {
      applyUserAgent(webview, state.uaMode);
      injectTouchStyle(webview);
    });
    webview.addEventListener('did-start-loading', () => setPanelStatus(panel, 'loading', 'Loading…'));
    webview.addEventListener('did-stop-loading', () => {
      injectTouchStyle(webview);
      setPanelStatus(panel, '', '');
      scheduleSave();
    });
    webview.addEventListener('did-finish-load', () => {
      injectTouchStyle(webview);
      setPanelStatus(panel, '', '');
    });
    webview.addEventListener('did-fail-load', (e) => {
      if (!e.isMainFrame || e.errorCode === -3) return;
      setPanelStatus(panel, 'error', `Error ${e.errorCode}`);
    });
    webview.addEventListener('did-navigate', (e) => {
      if (e && e.url) { state.url = e.url; if (document.activeElement !== urlField) urlField.value = e.url; injectTouchStyle(webview); scheduleSave(); }
    });
    webview.addEventListener('did-navigate-in-page', (e) => {
      if (e && e.isMainFrame && e.url) { state.url = e.url; if (document.activeElement !== urlField) urlField.value = e.url; scheduleSave(); }
    });

    renderInfo();
    workspace.appendChild(fragment);
    updateEmptyState();
    relayoutAll();

    if (opts.scroll !== false) {
      requestAnimationFrame(() => panel.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }));
    }

    navigatePanel(panel, state.url);
    return panel;
  }

  function addPanelFromControls() {
    const device = getSelectedDevice();
    const orientation = orientationSelect.value;
    const size = getTargetSize(device, orientation);
    const url = normalizeUrl(urlInput.value);
    createPanel({
      url, homeUrl: url, deviceName: device.name,
      width: size.width, height: size.height,
      orientation, uaMode: uaSelect.value || 'default',
    });
    scheduleSave();
  }

  function navigateAll(url) {
    const n = normalizeUrl(url);
    getPanels().forEach(p => navigatePanel(p, n));
  }

  function goSelectedOrAll() {
    const raw = (urlInput.value || '').trim();
    if (!raw) return;
    const sel = getSelectedPanel();
    if (sel) navigatePanel(sel, raw);
    else navigateAll(raw);
  }

  function clearAll() {
    if (!getPanels().length) return;
    if (!confirm('Close all device panels?')) return;
    getPanels().forEach(p => p.remove());
    selectedPanelId = null;
    updateEmptyState();
    relayoutAll();
    scheduleSave();
  }

  function setToolbarCollapsed(collapsed) {
    toolbar.classList.toggle('collapsed', collapsed);
    showBarBtn.classList.toggle('hidden', !collapsed);
    toggleBarBtn.title = collapsed ? 'Show toolbar' : 'Hide toolbar';
    // relayout after toolbar size changes affects workspace height
    requestAnimationFrame(relayoutAll);
    scheduleSave();
  }

  function restoreState() {
    const data = loadState();
    if (!data) return false;
    if (typeof data.urlInput === 'string') urlInput.value = data.urlInput;
    if (data.deviceSelect && [...deviceSelect.options].some(o => o.value === data.deviceSelect)) deviceSelect.value = data.deviceSelect;
    if (data.customWidth != null) customWidth.value = String(data.customWidth);
    if (data.customHeight != null) customHeight.value = String(data.customHeight);
    if (data.orientation) orientationSelect.value = data.orientation;
    if (data.uaMode && USER_AGENTS.hasOwnProperty(data.uaMode)) uaSelect.value = data.uaMode;
    if (data.scale && [...scaleSelect.options].some(o => o.value === String(data.scale))) scaleSelect.value = String(data.scale);
    else scaleSelect.value = 'fit';
    updateCustomVisibility();

    if (data.toolbarCollapsed) setToolbarCollapsed(true);

    if (Array.isArray(data.panels) && data.panels.length) {
      data.panels.forEach((p) => {
        if (!p) return;
        createPanel({
          url: p.url || 'about:blank',
          homeUrl: p.homeUrl || p.url || 'about:blank',
          deviceName: p.deviceName || 'Custom',
          width: p.width || 390,
          height: p.height || 844,
          orientation: p.orientation || 'portrait',
          uaMode: p.uaMode || 'default',
        }, { scroll: false });
      });
      requestAnimationFrame(() => { workspace.scrollLeft = 0; });
      return true;
    }
    return false;
  }

  // Events
  deviceSelect.addEventListener('change', () => { updateCustomVisibility(); scheduleSave(); });
  orientationSelect.addEventListener('change', scheduleSave);
  uaSelect.addEventListener('change', scheduleSave);
  customWidth.addEventListener('change', scheduleSave);
  customHeight.addEventListener('change', scheduleSave);
  scaleSelect.addEventListener('change', () => { relayoutAll(); scheduleSave(); });
  addPanelBtn.addEventListener('click', addPanelFromControls);
  goSelectedBtn.addEventListener('click', goSelectedOrAll);
  navigateAllBtn.addEventListener('click', () => { const v = urlInput.value.trim(); if (v) navigateAll(v); });
  clearAllBtn.addEventListener('click', clearAll);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPanelFromControls(); });
  urlInput.addEventListener('input', scheduleSave);

  toggleBarBtn.addEventListener('click', () => setToolbarCollapsed(true));
  showBarBtn.addEventListener('click', () => setToolbarCollapsed(false));

  workspace.addEventListener('mousedown', (e) => {
    if (e.target === workspace) setSelectedPanel(null);
  });

  window.addEventListener('resize', () => {
    relayoutAll();
  });

  // Init
  populateDevices();
  if (![...scaleSelect.options].some(o => o.value === scaleSelect.value)) scaleSelect.value = 'fit';
  const restored = restoreState();
  if (!restored) {
    scaleSelect.value = 'fit';
    updateEmptyState();
  } else {
    updateEmptyState();
  }
  // ensure layout correct after restore/size
  requestAnimationFrame(() => { relayoutAll(); requestAnimationFrame(relayoutAll); });
})();
