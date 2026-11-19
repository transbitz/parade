(function () {
  const DEVICE_PRESETS = [
    // Phones
    { group: 'Phones', name: 'iPhone SE (3rd)', width: 375, height: 667 },
    { group: 'Phones', name: 'iPhone 12/13/14', width: 390, height: 844 },
    { group: 'Phones', name: 'iPhone 14/15 Pro', width: 393, height: 852 },
    { group: 'Phones', name: 'iPhone 14/15 Pro Max', width: 430, height: 932 },
    { group: 'Phones', name: 'Pixel 7', width: 412, height: 915 },
    { group: 'Phones', name: 'Pixel 7 Pro', width: 412, height: 892 },
    { group: 'Phones', name: 'Samsung Galaxy S20', width: 360, height: 800 },
    { group: 'Phones', name: 'Samsung Galaxy S23', width: 360, height: 780 },

    // Flip phones
    { group: 'Flip phones', name: 'Galaxy Z Flip 5 (inner)', width: 412, height: 1004 },
    { group: 'Flip phones', name: 'Galaxy Z Flip 5 (cover)', width: 360, height: 748 },
    { group: 'Flip phones', name: 'Galaxy Z Flip 6 (inner)', width: 412, height: 1004 },
    { group: 'Flip phones', name: 'Galaxy Z Flip 6 (cover)', width: 360, height: 748 },
    { group: 'Flip phones', name: 'Motorola Razr+ (inner)', width: 412, height: 1080 },
    { group: 'Flip phones', name: 'Motorola Razr+ (cover)', width: 360, height: 800 },

    // Fold phones / foldables
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

    // Tablets
    { group: 'Tablets', name: 'iPad Mini', width: 768, height: 1024 },
    { group: 'Tablets', name: 'iPad Air', width: 820, height: 1180 },
    { group: 'Tablets', name: 'iPad Pro 11"', width: 834, height: 1194 },
    { group: 'Tablets', name: 'iPad Pro 12.9"', width: 1024, height: 1366 },
    { group: 'Tablets', name: 'Pixel Tablet', width: 800, height: 1280 },

    // Custom
    { group: 'Custom', name: 'Custom size', width: null, height: null, custom: true },
  ];

  const urlInput = document.getElementById('urlInput');
  const deviceSelect = document.getElementById('deviceSelect');
  const customSizeGroup = document.getElementById('customSizeGroup');
  const customWidth = document.getElementById('customWidth');
  const customHeight = document.getElementById('customHeight');
  const orientationSelect = document.getElementById('orientationSelect');
  const scaleSelect = document.getElementById('scaleSelect');
  const addPanelBtn = document.getElementById('addPanelBtn');
  const workspace = document.getElementById('workspace');
  const emptyState = document.getElementById('emptyState');
  const panelTemplate = document.getElementById('panelTemplate');
  const notice = document.getElementById('notice');
  const dismissNotice = document.getElementById('dismissNotice');

  let panelCounter = 0;

  function populateDevices() {
    const groups = new Map();
    for (const device of DEVICE_PRESETS) {
      if (!groups.has(device.group)) groups.set(device.group, []);
      groups.get(device.group).push(device);
    }

    for (const [groupName, devices] of groups.entries()) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = groupName;
      devices.forEach((device) => {
        const option = document.createElement('option');
        option.value = device.name;
        option.textContent = device.name;
        optgroup.appendChild(option);
      });
      deviceSelect.appendChild(optgroup);
    }

    // Default to a common phone
    deviceSelect.value = 'iPhone 14/15 Pro';
    updateCustomVisibility();
  }

  function getSelectedDevice() {
    const name = deviceSelect.value;
    return DEVICE_PRESETS.find((d) => d.name === name) || DEVICE_PRESETS[0];
  }

  function updateCustomVisibility() {
    const device = getSelectedDevice();
    customSizeGroup.classList.toggle('hidden', !device.custom);
  }

  function normalizeUrl(raw) {
    let url = (raw || '').trim();
    if (!url) return 'about:blank';
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
      // Looks like localhost or domain without scheme
      if (/^(localhost|127\.0\.0\.1|\[::1\])(\:\d+)?(\/.*)?$/i.test(url)) {
        url = 'http://' + url;
      } else {
        url = 'https://' + url;
      }
    }
    return url;
  }

  function getScale() {
    const s = parseFloat(scaleSelect.value);
    return Number.isFinite(s) && s > 0 ? s : 1;
  }

  function getTargetSize(device, orientation) {
    let w, h;
    if (device.custom) {
      w = parseInt(customWidth.value, 10) || 390;
      h = parseInt(customHeight.value, 10) || 844;
    } else {
      w = device.width;
      h = device.height;
    }
    w = Math.max(200, Math.min(3000, w));
    h = Math.max(200, Math.min(3000, h));
    if (orientation === 'landscape') {
      return { width: h, height: w };
    }
    return { width: w, height: h };
  }

  function applyScaleToFrame(frame, screen, width, height, scale) {
    screen.style.width = width + 'px';
    screen.style.height = height + 'px';
    frame.style.width = (width + 20) + 'px'; // padding around screen
    frame.style.height = (height + 20) + 'px';
    frame.style.transform = `scale(${scale})`;
    frame.style.marginRight = ((width + 20) * (scale - 1)) + 'px';
    frame.style.marginBottom = ((height + 20) * (scale - 1)) + 'px';
  }

  function updateEmptyState() {
    const hasPanels = workspace.querySelectorAll('.panel').length > 0;
    emptyState.style.display = hasPanels ? 'none' : '';
  }

  function createPanel(config) {
    panelCounter += 1;
    const fragment = panelTemplate.content.cloneNode(true);
    const panel = fragment.querySelector('.panel');
    const titleEl = fragment.querySelector('.panel-title');
    const subtitleEl = fragment.querySelector('.panel-subtitle');
    const urlField = fragment.querySelector('.panel-url');
    const goBtn = fragment.querySelector('.go-btn');
    const iframe = fragment.querySelector('.device-screen');
    const frame = fragment.querySelector('.device-frame');
    const rotateBtn = fragment.querySelector('.rotate-btn');
    const reloadBtn = fragment.querySelector('.reload-btn');
    const closeBtn = fragment.querySelector('.close-btn');

    const state = {
      id: panelCounter,
      url: config.url,
      deviceName: config.deviceName,
      width: config.width,
      height: config.height,
      orientation: config.orientation,
    };

    panel.dataset.panelId = String(state.id);

    function render() {
      const scale = getScale();
      panel.dataset.width = String(state.width);
      panel.dataset.height = String(state.height);
      panel.dataset.orientation = state.orientation;
      titleEl.textContent = state.deviceName;
      subtitleEl.textContent = `${state.width} × ${state.height} (${state.orientation})`;
      urlField.value = state.url;
      applyScaleToFrame(frame, iframe, state.width, state.height, scale);
    }

    function navigate(nextUrl) {
      state.url = normalizeUrl(nextUrl);
      urlField.value = state.url;
      iframe.src = state.url;
    }

    rotateBtn.addEventListener('click', () => {
      const tmp = state.width;
      state.width = state.height;
      state.height = tmp;
      state.orientation = state.orientation === 'portrait' ? 'landscape' : 'portrait';
      render();
    });

    reloadBtn.addEventListener('click', () => {
      // Reload iframe; resetting src forces reload even for same URL
      const current = iframe.src || state.url;
      iframe.src = 'about:blank';
      setTimeout(() => { iframe.src = current; }, 0);
    });

    closeBtn.addEventListener('click', () => {
      panel.remove();
      updateEmptyState();
    });

    goBtn.addEventListener('click', () => navigate(urlField.value));
    urlField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') navigate(urlField.value);
    });

    render();
    navigate(state.url);
    workspace.appendChild(fragment);
    updateEmptyState();

    // Scroll new panel into view
    requestAnimationFrame(() => {
      panel.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });
    });
  }

  function addPanelFromControls() {
    const device = getSelectedDevice();
    const orientation = orientationSelect.value;
    const size = getTargetSize(device, orientation);
    const url = normalizeUrl(urlInput.value);

    createPanel({
      url,
      deviceName: device.name,
      width: size.width,
      height: size.height,
      orientation,
    });

    if (urlInput.value.trim()) {
      // keep URL for convenience, no-op
    }
  }

  function rescaleAllPanels() {
    const scale = getScale();
    workspace.querySelectorAll('.panel').forEach((panel) => {
      const frame = panel.querySelector('.device-frame');
      const screen = panel.querySelector('.device-screen');
      if (!frame || !screen) return;
      const width = parseInt(panel.dataset.width, 10);
      const height = parseInt(panel.dataset.height, 10);
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;
      applyScaleToFrame(frame, screen, width, height, scale);
    });
  }

  deviceSelect.addEventListener('change', updateCustomVisibility);
  scaleSelect.addEventListener('change', rescaleAllPanels);
  addPanelBtn.addEventListener('click', addPanelFromControls);

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addPanelFromControls();
  });

  dismissNotice.addEventListener('click', () => {
    notice.classList.add('hidden');
  });

  populateDevices();
  updateEmptyState();
})();
