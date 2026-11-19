(function () {
  const STORAGE_KEY = 'multibrowser.display.v1';
  const mb = window.multibrowser;

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
  ];

  const workspace = document.getElementById('workspace');
  const emptyState = document.getElementById('emptyState');
  const panelTemplate = document.getElementById('panelTemplate');

  let panelCounter = 0;
  let saveTimer = null;
  let selectedPanelId = null;
  let currentScale = '1';
  let boundsRaf = null;

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 250);
  }

  function getPanels() { return Array.from(workspace.querySelectorAll('.panel')); }

  function getSelectedPanel() {
    if (!selectedPanelId) return null;
    return getPanels().find(p => p.dataset.panelId === selectedPanelId) || null;
  }

  function setSelectedPanel(panel) {
    getPanels().forEach(p => p.classList.toggle('selected', p === panel));
    selectedPanelId = panel ? panel.dataset.panelId : null;
  }

  // --- Device view bounds sync --------------------------------------------
  // Each panel's device view (a WebContentsView hosted by the main process)
  // must exactly cover .panel-screen-wrap. Views are detached while a panel's
  // controls overlay is open so the HTML overlay stays interactive.

  function syncViewBounds() {
    if (!mb || typeof mb.viewSetBounds !== 'function') return;
    const items = [];
    getPanels().forEach((panel) => {
      const rec = panel.__mbView;
      const wrap = panel.querySelector('.panel-screen-wrap');
      if (!rec || !rec.created || !wrap) return;
      if (panel.classList.contains('controls-open')) {
        if (rec.shown) {
          rec.shown = false;
          rec.bounds = null;
          items.push({ panelId: rec.id, bounds: null });
        }
        return;
      }
      const r = wrap.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const b = {
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
      const same = rec.shown && rec.bounds && rec.bounds.x === b.x && rec.bounds.y === b.y &&
        rec.bounds.width === b.width && rec.bounds.height === b.height;
      if (!same) {
        rec.shown = true;
        rec.bounds = b;
        items.push({ panelId: rec.id, bounds: b });
      }
    });
    if (items.length) mb.viewSetBounds(items);
  }

  function scheduleBoundsSync() {
    if (boundsRaf) return;
    boundsRaf = requestAnimationFrame(() => {
      boundsRaf = null;
      syncViewBounds();
      updateScrollbar();
    });
  }

  // --- Smooth screen-to-screen scrolling ------------------------------------
  // Horizontal swipe gestures (3-finger, or 2-finger horizontal over the
  // background/bars) glide the workspace from one device screen to the next
  // and settle exactly on a panel edge. Vertical scrolling and anything over a
  // device screen itself stays native (the page scrolls inside the screen).

  const SWIPE_COMMIT_MS = 150;
  const SWIPE_THRESHOLD_PX = 80;
  const SNAP_ANIMATION_MS = 350;
  const WORKSPACE_PADDING = 2;
  const PANEL_BAR_H = 26;
  let swipe = null;
  let snapRaf = null;

  function snapTargets() {
    const sl = workspace.scrollLeft;
    return getPanels().map((panel) => {
      const contentLeft = panel.getBoundingClientRect().left + sl;
      return { panel, left: Math.max(0, Math.round(contentLeft - WORKSPACE_PADDING)) };
    }).sort((a, b) => a.left - b.left);
  }

  // Snap targets can sit past the scrollable range when several scaled
  // screens fit the window; those screens all share the clamped end
  // position, so "nearest screen" is computed against the reachable position.
  function reachableLeft(target, max) {
    return Math.min(target.left, max);
  }

  function nearestReachableIndex(targets, max, pos) {
    if (!targets.length) return -1;
    let best = 0;
    let bestDist = Infinity;
    targets.forEach((t, i) => {
      const d = Math.abs(reachableLeft(t, max) - pos);
      // Ties resolve to the last index: the clamped tail is the end screen.
      if (d <= bestDist) { bestDist = d; best = i; }
    });
    return best;
  }

  function maxScroll() {
    return Math.max(0, workspace.scrollWidth - workspace.clientWidth);
  }

  function animateScrollLeft(target, duration) {
    if (snapRaf) { cancelAnimationFrame(snapRaf); snapRaf = null; }
    const max = Math.max(0, workspace.scrollWidth - workspace.clientWidth);
    target = Math.max(0, Math.min(max, Math.round(target)));
    const start = workspace.scrollLeft;
    const delta = target - start;
    if (Math.abs(delta) < 1) { workspace.scrollLeft = target; return; }
    const dur = duration || SNAP_ANIMATION_MS;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      workspace.scrollLeft = start + delta * eased;
      if (p < 1) {
        snapRaf = requestAnimationFrame(tick);
      } else {
        snapRaf = null;
        workspace.scrollLeft = target;
      }
    };
    snapRaf = requestAnimationFrame(tick);
  }

  function snapToIndex(index, targetsIn) {
    const targets = targetsIn || snapTargets();
    if (!targets.length) return;
    const i = Math.max(0, Math.min(targets.length - 1, index));
    animateScrollLeft(targets[i].left);
  }

  function stepScreens(dir) {
    const targets = snapTargets();
    if (!targets.length) return;
    const max = maxScroll();
    const cur = nearestReachableIndex(targets, max, workspace.scrollLeft);
    const curL = reachableLeft(targets[cur], max);
    // Skip screens that share a clamped position so stepping always moves
    // the viewport (or stays put when there is nowhere left to go).
    if (dir > 0) {
      for (let i = cur + 1; i < targets.length; i++) {
        if (reachableLeft(targets[i], max) > curL + 1) { snapToIndex(i, targets); return; }
      }
    } else {
      for (let i = cur - 1; i >= 0; i--) {
        if (reachableLeft(targets[i], max) < curL - 1) { snapToIndex(i, targets); return; }
      }
    }
    snapToIndex(cur, targets);
  }

  function endSwipe() {
    if (!swipe) return;
    const total = swipe.total;
    const tookOver = swipe.tookOver;
    if (swipe.timer) clearTimeout(swipe.timer);
    swipe = null;
    const targets = snapTargets();
    if (!targets.length) return;
    const max = maxScroll();
    if (Math.abs(total) < SWIPE_THRESHOLD_PX) {
      // Tiny drift: let an in-progress glide finish, otherwise settle on
      // the screen we're closest to.
      if (!tookOver && snapRaf === null) {
        snapToIndex(nearestReachableIndex(targets, max, workspace.scrollLeft), targets);
      }
      return;
    }
    // Move the viewport by the distance the gesture travelled, then snap to
    // the nearest screen. Works from any scroll position — mid-glide,
    // clamped, or at rest — so consecutive swipes chain seamlessly.
    const first = reachableLeft(targets[0], max);
    const last = reachableLeft(targets[targets.length - 1], max);
    const step = targets.length > 1 ? Math.max(80, (last - first) / (targets.length - 1)) : max || 400;
    const capped = Math.max(-4 * step, Math.min(4 * step, total));
    const desired = Math.max(0, Math.min(max, workspace.scrollLeft + capped));
    snapToIndex(nearestReachableIndex(targets, max, desired), targets);
  }

  function feedSwipe(deltaX) {
    if (!deltaX) return;
    if (!swipe) swipe = { total: 0, timer: null, tookOver: false };
    swipe.total += deltaX;
    if (!swipe.tookOver && Math.abs(swipe.total) >= SWIPE_THRESHOLD_PX) {
      // A real gesture takes over from any snap animation in flight.
      swipe.tookOver = true;
      if (snapRaf) { cancelAnimationFrame(snapRaf); snapRaf = null; }
    }
    if (swipe.timer) clearTimeout(swipe.timer);
    swipe.timer = setTimeout(endSwipe, SWIPE_COMMIT_MS);
  }

  function onWorkspaceWheel(e) {
    // Never steal input meant for the controls overlay (URL field, selects…).
    if (e.target && e.target.closest && e.target.closest('.panel-overlay')) return;
    if (e.ctrlKey) { e.preventDefault(); return; } // don't zoom the host UI
    const dx = e.deltaX || 0;
    const dy = e.deltaY || 0;
    if (Math.abs(dx) <= Math.abs(dy)) return; // vertical scroll → native behavior
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 400 : 1);
    feedSwipe(dx * unit);
  }

  function onKeyDown(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault(); stepScreens(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault(); stepScreens(-1);
    } else if (e.key === 'Home') {
      e.preventDefault(); snapToIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault(); const n = snapTargets().length; if (n) snapToIndex(n - 1);
    }
  }

  // --- Bottom scrollbar: a draggable track for screen-to-screen navigation ---
  const scrollbarEl = document.getElementById('screenScrollbar');
  const scrollbarThumb = document.getElementById('screenScrollbarThumb');
  let thumbW = 80;
  let barDrag = null;

  function updateScrollbar() {
    if (!scrollbarEl || !scrollbarThumb) return;
    const max = Math.max(0, workspace.scrollWidth - workspace.clientWidth);
    const trackW = scrollbarEl.clientWidth;
    if (max <= 1 || trackW < 40) {
      scrollbarThumb.style.display = 'none';
      return;
    }
    scrollbarThumb.style.display = '';
    const ratio = Math.min(1, workspace.clientWidth / workspace.scrollWidth);
    thumbW = Math.max(40, Math.round(trackW * ratio));
    const x = (workspace.scrollLeft / max) * (trackW - thumbW);
    scrollbarThumb.style.width = thumbW + 'px';
    scrollbarThumb.style.left = Math.max(0, Math.min(trackW - thumbW, Math.round(x))) + 'px';
  }

  if (scrollbarEl && scrollbarThumb) {
    scrollbarThumb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // The drag owns the scroll position from here on.
      if (snapRaf) { cancelAnimationFrame(snapRaf); snapRaf = null; }
      barDrag = { startX: e.clientX, startScroll: workspace.scrollLeft };
      scrollbarThumb.classList.add('dragging');
      try { scrollbarThumb.setPointerCapture(e.pointerId); } catch (_) {}
    });
    scrollbarThumb.addEventListener('pointermove', (e) => {
      if (!barDrag) return;
      const trackW = scrollbarEl.clientWidth;
      const travel = Math.max(1, trackW - thumbW);
      const max = Math.max(0, workspace.scrollWidth - workspace.clientWidth);
      workspace.scrollLeft = barDrag.startScroll + ((e.clientX - barDrag.startX) / travel) * max;
    });
    const endBarDrag = (e) => {
      if (!barDrag) return;
      barDrag = null;
      scrollbarThumb.classList.remove('dragging');
      try { scrollbarThumb.releasePointerCapture(e.pointerId); } catch (_) {}
      const targets = snapTargets();
      snapToIndex(nearestReachableIndex(targets, maxScroll(), workspace.scrollLeft), targets);
    };
    scrollbarThumb.addEventListener('pointerup', endBarDrag);
    scrollbarThumb.addEventListener('pointercancel', endBarDrag);
    scrollbarEl.addEventListener('click', (e) => {
      if (e.target === scrollbarThumb || barDrag) return;
      const rect = scrollbarEl.getBoundingClientRect();
      const trackW = scrollbarEl.clientWidth;
      const max = Math.max(0, workspace.scrollWidth - workspace.clientWidth);
      const target = max * ((e.clientX - rect.left) / trackW);
      const targets = snapTargets();
      if (!targets.length) return;
      let best = targets[0];
      let bestDist = Infinity;
      for (const t of targets) {
        const d = Math.abs(reachableLeft(t, max) - target);
        if (d < bestDist) { bestDist = d; best = t; }
      }
      animateScrollLeft(best.left);
    });
    scrollbarEl.addEventListener('wheel', (e) => {
      if (e.ctrlKey) { e.preventDefault(); return; }
      const dx = e.deltaX || 0;
      const dy = e.deltaY || 0;
      if (Math.abs(dx) <= Math.abs(dy)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 400 : 1);
      feedSwipe(dx * unit);
    }, { passive: false });
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, scale: currentScale, panels }));
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function findPreset(name) { return DEVICE_PRESETS.find(d => d.name === name); }

  function populatePanelDeviceSelect(selectEl) {
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
      selectEl.appendChild(og);
    }
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = 'Custom size';
    selectEl.appendChild(customOpt);
  }

  function normalizeUrl(raw) {
    let url = (raw || '').trim();
    if (!url) return 'about:blank';
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
      if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/.*)?$/i.test(url)) url = 'http://' + url;
      else url = 'https://' + url;
    }
    return url;
  }

  // Scale each device so the whole screen fits the window (like DevTools'
  // "fit" zoom). The view is laid out at the scaled size, and a matching page
  // zoom keeps the CSS viewport at the true device dimensions.
  function getScaleFor(width, height) {
    const availH = workspace.clientHeight - WORKSPACE_PADDING * 2 - PANEL_BAR_H;
    const availW = workspace.clientWidth - WORKSPACE_PADDING * 2;
    if (availH < 40 || availW < 40) return 1;
    return Math.max(0.05, Math.min(1, availH / height, availW / width));
  }

  function applyLayout(panel) {
    const s = panel.__mbState;
    const sizer = panel.querySelector('.panel-sizer');
    const wrap = panel.querySelector('.panel-screen-wrap');
    if (!s || !sizer || !wrap) return;
    const scale = getScaleFor(s.width, s.height);
    const w = s.width, h = s.height;
    if (!(w > 0) || !(h > 0)) return;
    const bw = Math.round(w * scale);
    const bh = Math.round(h * scale);
    panel.dataset.width = String(w);
    panel.dataset.height = String(h);
    panel.dataset.scale = scale.toFixed(4);
    sizer.style.width = bw + 'px';
    sizer.style.height = bh + 'px';
    wrap.style.width = w + 'px';
    wrap.style.height = h + 'px';
    wrap.style.transform = scale === 1 ? 'none' : `scale(${scale})`;
    // The view is laid out at the integer size bw×bh, so pick the zoom that
    // maps it back to the true device CSS viewport (innerWidth === w). The
    // tiny downward nudge keeps floor(bw / zoom) from landing on w−1.
    const zoom = Math.min(bw / w, bh / h) * (1 - 1e-9);
    const rec = panel.__mbView;
    if (rec && mb && typeof mb.viewControl === 'function' && rec.lastZoom !== zoom) {
      rec.lastZoom = zoom;
      mb.viewControl(rec.id, 'set-zoom', { zoomFactor: zoom });
    }
    scheduleBoundsSync();
  }

  function relayoutAll() { getPanels().forEach(applyLayout); scheduleBoundsSync(); }
  function updateEmptyState() { emptyState.style.display = getPanels().length ? 'none' : ''; }

  function setPanelStatus(panel, type, text) {
    const el = panel.querySelector('.panel-status-text');
    if (!el) return;
    el.classList.remove('error', 'loading');
    if (type) el.classList.add(type);
    el.textContent = text || '';
  }

  function navigatePanel(panel, nextUrl) {
    const s = panel.__mbState;
    const rec = panel.__mbView;
    const urlField = panel.querySelector('.panel-url');
    if (!s || !rec) return;
    s.url = normalizeUrl(nextUrl);
    if (urlField) urlField.value = s.url;
    setPanelStatus(panel, 'loading', 'Loading…');
    if (rec.created) {
      mb.viewNavigate(rec.id, s.url);
    } else {
      rec.pendingUrl = s.url;
    }
    scheduleSave();
  }

  function handleViewEvent(msg) {
    if (!msg || !msg.type) return;
    const panel = getPanels().find(p => p.__mbView && p.__mbView.id === msg.panelId);
    if (!panel) return;
    const state = panel.__mbState;
    const urlField = panel.querySelector('.panel-url');
    switch (msg.type) {
      case 'did-start-loading':
        setPanelStatus(panel, 'loading', 'Loading…');
        break;
      case 'did-stop-loading':
        setPanelStatus(panel, '', '');
        scheduleSave();
        break;
      case 'did-finish-load':
        setPanelStatus(panel, '', '');
        break;
      case 'did-fail-load':
        setPanelStatus(panel, 'error', `Error ${msg.errorCode}`);
        break;
      case 'did-navigate':
      case 'did-navigate-in-page':
        if (msg.url && state) {
          state.url = msg.url;
          if (urlField && document.activeElement !== urlField) urlField.value = msg.url;
          scheduleSave();
        }
        break;
      case 'focus':
        setSelectedPanel(panel);
        break;
      default:
        break;
    }
  }

  function createPanel(config, opts = {}) {
    panelCounter += 1;
    const fragment = panelTemplate.content.cloneNode(true);
    const panel = fragment.querySelector('.panel');
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

    // Device view record (the actual page lives in a WebContentsView owned by
    // the main process and is positioned over .panel-screen-wrap).
    const rec = { id: state.id, created: false, shown: false, bounds: null, pendingUrl: null };
    panel.__mbView = rec;

    if (mb && typeof mb.viewCreate === 'function') {
      mb.viewCreate({ panelId: rec.id, userAgent: USER_AGENTS[state.uaMode] || '' }).then(() => {
        rec.created = true;
        if (!panel.isConnected) {
          // Panel was closed/removed before the view finished creating.
          mb.viewDestroy(rec.id);
          return;
        }
        if (rec.pendingUrl) {
          const u = rec.pendingUrl;
          rec.pendingUrl = null;
          mb.viewNavigate(rec.id, u);
        }
        rec.shown = false;
        rec.bounds = null;
        scheduleBoundsSync();
      }).catch(() => {});
    }

    function renderInfo() {
      nameEl.textContent = state.deviceName;
      dimsEl.textContent = `${state.width}×${state.height}`;
      const preset = findPreset(state.deviceName);
      deviceSel.value = (preset && !preset.custom) ? state.deviceName : '__custom__';
      if (urlField && document.activeElement !== urlField) urlField.value = state.url;
      applyLayout(panel);
    }

    const openControls = () => {
      panel.classList.add('controls-open');
      setSelectedPanel(panel);
      scheduleBoundsSync();
      setTimeout(() => { try { urlField.focus(); urlField.select(); } catch (_) {} }, 0);
    };
    const closeControls = () => {
      panel.classList.remove('controls-open');
      scheduleBoundsSync();
    };

    panel.addEventListener('mousedown', () => setSelectedPanel(panel));
    panel.addEventListener('focusin', () => setSelectedPanel(panel));
    toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); panel.classList.contains('controls-open') ? closeControls() : openControls(); });
    toggleBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    hideControlsBtn.addEventListener('click', (e) => { e.stopPropagation(); closeControls(); });
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) { e.stopPropagation(); closeControls(); } });

    backBtn.addEventListener('click', (e) => { e.stopPropagation(); if (mb) mb.viewControl(rec.id, 'back'); });
    forwardBtn.addEventListener('click', (e) => { e.stopPropagation(); if (mb) mb.viewControl(rec.id, 'forward'); });
    reloadBtn.addEventListener('click', (e) => { e.stopPropagation(); if (mb) mb.viewControl(rec.id, 'reload'); });
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = state.width; state.width = state.height; state.height = t;
      state.orientation = state.orientation === 'portrait' ? 'landscape' : 'portrait';
      renderInfo(); relayoutAll(); scheduleSave();
    });
    devtoolsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mb) mb.viewControl(rec.id, 'devtools');
    });
    duplicateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      createPanel({ ...state }, { scroll: true });
      scheduleSave();
    });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasSelected = selectedPanelId === panel.dataset.panelId;
      if (mb) mb.viewDestroy(rec.id);
      panel.remove();
      if (wasSelected) selectedPanelId = null;
      updateEmptyState(); relayoutAll(); scheduleSave();
    });

    deviceSel.addEventListener('change', (e) => {
      e.stopPropagation();
      const val = deviceSel.value;
      if (val === '__custom__') {
        state.deviceName = 'Custom';
      } else {
        const preset = findPreset(val);
        if (preset) {
          let w = preset.width, h = preset.height;
          if (state.orientation === 'landscape') { const tmp = w; w = h; h = tmp; }
          state.deviceName = preset.name; state.width = w; state.height = h;
        }
      }
      renderInfo(); relayoutAll(); scheduleSave();
    });

    goBtn.addEventListener('click', (e) => { e.stopPropagation(); navigatePanel(panel, urlField.value); closeControls(); });
    urlField.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); navigatePanel(panel, urlField.value); closeControls(); } });
    urlField.addEventListener('mousedown', (e) => e.stopPropagation());
    deviceSel.addEventListener('mousedown', (e) => e.stopPropagation());

    renderInfo();
    workspace.appendChild(fragment);
    updateEmptyState();
    relayoutAll();
    if (opts.scroll !== false) {
      requestAnimationFrame(() => {
        const targets = snapTargets();
        const i = targets.findIndex(t => t.panel === panel);
        if (i >= 0) snapToIndex(i, targets);
      });
    }
    navigatePanel(panel, state.url);
    return panel;
  }

  function navigateAll(url) {
    const n = normalizeUrl(url);
    getPanels().forEach(p => navigatePanel(p, n));
  }

  function navigateSelectedOrAll(url) {
    const sel = getSelectedPanel();
    if (sel) navigatePanel(sel, url);
    else navigateAll(url);
  }

  function clearAll() {
    if (!getPanels().length) return;
    getPanels().forEach(p => {
      if (p.__mbView && mb) mb.viewDestroy(p.__mbView.id);
      p.remove();
    });
    selectedPanelId = null;
    updateEmptyState(); relayoutAll(); scheduleSave();
  }

  function handleCommand(msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'add-panel':
        if (msg.panel) createPanel(msg.panel);
        scheduleSave();
        break;
      case 'navigate-selected':
        if (msg.url) navigateSelectedOrAll(msg.url);
        break;
      case 'navigate-all':
        if (msg.url) navigateAll(msg.url);
        break;
      case 'clear':
        clearAll();
        break;
      case 'set-scale':
        currentScale = '1';
        relayoutAll();
        scheduleSave();
        break;
      default:
        break;
    }
  }

  function restoreState() {
    const data = loadState();
    if (!data) return;
    currentScale = '1';
    if (Array.isArray(data.panels) && data.panels.length) {
      data.panels.forEach(p => { if (p) createPanel(p, { scroll: false }); });
      requestAnimationFrame(() => { workspace.scrollLeft = 0; });
    }
  }

  workspace.addEventListener('mousedown', (e) => { if (e.target === workspace) setSelectedPanel(null); });
  workspace.addEventListener('scroll', () => scheduleBoundsSync());
  workspace.addEventListener('wheel', onWorkspaceWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', () => { relayoutAll(); });

  if (mb && typeof mb.onCommand === 'function') {
    mb.onCommand(handleCommand);
  }
  if (mb && typeof mb.onViewEvent === 'function') {
    mb.onViewEvent(handleViewEvent);
  }
  if (mb && typeof mb.onSwipe === 'function') {
    // Horizontal swipes detected inside device views feed the same carousel.
    mb.onSwipe((msg) => { if (msg && typeof msg.deltaX === 'number') feedSwipe(msg.deltaX); });
  }

  restoreState();
  updateEmptyState();
  requestAnimationFrame(() => { relayoutAll(); requestAnimationFrame(relayoutAll); });
})();
