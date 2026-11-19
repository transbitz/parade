(function () {
  const DEVICE_PRESETS = [
    { group: 'Phones', name: 'iPhone SE (3rd)', width: 375, height: 667, dpr: 2 },
    { group: 'Phones', name: 'iPhone 12/13/14', width: 390, height: 844, dpr: 3 },
    { group: 'Phones', name: 'iPhone 14/15 Pro', width: 393, height: 852, dpr: 3 },
    { group: 'Phones', name: 'iPhone 14/15 Pro Max', width: 430, height: 932, dpr: 3 },
    { group: 'Phones', name: 'Pixel 7', width: 412, height: 915, dpr: 2.625 },
    { group: 'Phones', name: 'Pixel 7 Pro', width: 412, height: 892, dpr: 2.625 },
    { group: 'Phones', name: 'Samsung Galaxy S20', width: 360, height: 800, dpr: 3 },
    { group: 'Phones', name: 'Samsung Galaxy S23', width: 360, height: 780, dpr: 3 },

    { group: 'Flip phones', name: 'Galaxy Z Flip 5 (inner)', width: 412, height: 1004, dpr: 2.625 },
    { group: 'Flip phones', name: 'Galaxy Z Flip 5 (cover)', width: 360, height: 748, dpr: 3 },
    { group: 'Flip phones', name: 'Galaxy Z Flip 6 (inner)', width: 412, height: 1004, dpr: 2.625 },
    { group: 'Flip phones', name: 'Galaxy Z Flip 6 (cover)', width: 360, height: 748, dpr: 3 },
    { group: 'Flip phones', name: 'Motorola Razr+ (inner)', width: 412, height: 1080, dpr: 2.625 },
    { group: 'Flip phones', name: 'Motorola Razr+ (cover)', width: 360, height: 800, dpr: 3 },

    { group: 'Foldables', name: 'Galaxy Z Fold 5 (inner)', width: 768, height: 1076, dpr: 2.625 },
    { group: 'Foldables', name: 'Galaxy Z Fold 5 (cover)', width: 373, height: 819, dpr: 3 },
    { group: 'Foldables', name: 'Galaxy Z Fold 6 (inner)', width: 768, height: 1076, dpr: 2.625 },
    { group: 'Foldables', name: 'Galaxy Z Fold 6 (cover)', width: 374, height: 832, dpr: 3 },
    { group: 'Foldables', name: 'Pixel Fold (inner)', width: 841, height: 701, dpr: 2.625 },
    { group: 'Foldables', name: 'Pixel Fold (cover)', width: 412, height: 892, dpr: 2.625 },
    { group: 'Foldables', name: 'OnePlus Open (inner)', width: 857, height: 800, dpr: 2.625 },
    { group: 'Foldables', name: 'OnePlus Open (cover)', width: 387, height: 804, dpr: 3 },
    { group: 'Foldables', name: 'Surface Duo (single)', width: 360, height: 720, dpr: 2.5 },
    { group: 'Foldables', name: 'Surface Duo (dual)', width: 720, height: 720, dpr: 2.5 },

    { group: 'Tablets', name: 'iPad Mini', width: 768, height: 1024, dpr: 2 },
    { group: 'Tablets', name: 'iPad Air', width: 820, height: 1180, dpr: 2 },
    { group: 'Tablets', name: 'iPad Pro 11"', width: 834, height: 1194, dpr: 2 },
    { group: 'Tablets', name: 'iPad Pro 12.9"', width: 1024, height: 1366, dpr: 2 },
    { group: 'Tablets', name: 'Pixel Tablet', width: 800, height: 1280, dpr: 2 },

    { group: 'Custom', name: 'Custom size', width: null, height: null, custom: true, dpr: 1 },
  ];

  const FORM_KEY = 'multibrowser.control.v1';

  const urlInput = document.getElementById('urlInput');
  const deviceSelect = document.getElementById('deviceSelect');
  const customSizeGroup = document.getElementById('customSizeGroup');
  const customWidth = document.getElementById('customWidth');
  const customHeight = document.getElementById('customHeight');
  const orientationSelect = document.getElementById('orientationSelect');
  const uaSelect = document.getElementById('uaSelect');
  const addBtn = document.getElementById('addBtn');
  const goSelectedBtn = document.getElementById('goSelectedBtn');
  const goAllBtn = document.getElementById('goAllBtn');
  const showDisplayBtn = document.getElementById('showDisplayBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusText = document.getElementById('statusText');

  function setStatus(msg) { statusText.textContent = msg; }

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
    deviceSelect.value = 'iPhone 14/15 Pro';
  }

  function getDevice() {
    return DEVICE_PRESETS.find(d => d.name === deviceSelect.value) || DEVICE_PRESETS[0];
  }

  function updateCustomVisibility() {
    customSizeGroup.classList.toggle('hidden', !getDevice().custom);
  }

  function normalizeUrl(raw) {
    let url = (raw || '').trim();
    if (!url) return '';
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
      if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/.*)?$/i.test(url)) url = 'http://' + url;
      else url = 'https://' + url;
    }
    return url;
  }

  function getSize(device, orientation) {
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

  function saveForm() {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify({
        url: urlInput.value, device: deviceSelect.value,
        customWidth: customWidth.value, customHeight: customHeight.value,
        orientation: orientationSelect.value, ua: uaSelect.value,
      }));
    } catch (_) {}
  }

  function loadForm() {
    try {
      const raw = localStorage.getItem(FORM_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d) return;
      if (d.url) urlInput.value = d.url;
      if (d.device && [...deviceSelect.options].some(o => o.value === d.device)) deviceSelect.value = d.device;
      if (d.customWidth) customWidth.value = d.customWidth;
      if (d.customHeight) customHeight.value = d.customHeight;
      if (d.orientation) orientationSelect.value = d.orientation;
      if (d.ua) uaSelect.value = d.ua;
    } catch (_) {}
  }

  async function ensureDisplay() {
    if (window.multibrowser) await window.multibrowser.ensureDisplay();
  }

  function send(msg) {
    if (window.multibrowser) window.multibrowser.sendCommand(msg);
  }

  async function addDevice() {
    const url = normalizeUrl(urlInput.value) || 'about:blank';
    urlInput.value = url === 'about:blank' ? '' : url;
    const device = getDevice();
    const orientation = orientationSelect.value;
    const size = getSize(device, orientation);
    const deviceScaleFactor = device.dpr || 1;
    await ensureDisplay();
    send({
      type: 'add-panel',
      panel: {
        url, homeUrl: url, deviceName: device.name,
        width: size.width, height: size.height,
        orientation, uaMode: uaSelect.value || 'default',
        deviceScaleFactor,
      }
    });
    send({ type: 'set-scale', scale: '1' });
    setStatus(`Added: ${device.name} (${size.width}×${size.height} @${deviceScaleFactor}x)`);
    saveForm();
  }

  async function goSelected() {
    const url = normalizeUrl(urlInput.value);
    if (!url) { setStatus('Enter a URL first'); return; }
    urlInput.value = url;
    await ensureDisplay();
    send({ type: 'navigate-selected', url });
    setStatus('Sent URL to selected device (or all if none selected)');
    saveForm();
  }

  async function goAll() {
    const url = normalizeUrl(urlInput.value);
    if (!url) { setStatus('Enter a URL first'); return; }
    urlInput.value = url;
    await ensureDisplay();
    send({ type: 'navigate-all', url });
    setStatus('Sent URL to all devices');
    saveForm();
  }

  async function clearAll() {
    await ensureDisplay();
    send({ type: 'clear' });
    setStatus('Clear requested');
  }

  async function showDisplay() {
    await ensureDisplay();
    if (window.multibrowser) await window.multibrowser.focusDisplay();
    setStatus('Device window shown');
  }

  deviceSelect.addEventListener('change', () => { updateCustomVisibility(); saveForm(); });
  [urlInput, customWidth, customHeight, orientationSelect, uaSelect].forEach(el => {
    el.addEventListener('change', saveForm);
    el.addEventListener('input', saveForm);
  });

  addBtn.addEventListener('click', addDevice);
  goSelectedBtn.addEventListener('click', goSelected);
  goAllBtn.addEventListener('click', goAll);
  clearBtn.addEventListener('click', clearAll);
  showDisplayBtn.addEventListener('click', showDisplay);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addDevice(); });

  populateDevices();
  loadForm();
  updateCustomVisibility();
})();
