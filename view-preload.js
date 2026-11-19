// Runs inside every device view (page). Forwards horizontal swipe gestures to
// the Parade workspace so swiping across a screen glides to the next/previous
// device screen — but only when the page itself cannot scroll sideways, so
// in-page horizontal panning and all vertical (2-finger) scrolling stay native.
const { ipcRenderer } = require('electron');

// DevTools-style touch indicator: a fading circle at every tap point.
let lastTouchAt = 0;
function showTouchIndicator(x, y) {
  try {
    const host = document.body || document.documentElement;
    if (!host) return;
    const el = document.createElement('div');
    el.setAttribute('data-parade-touch', '1');
    el.style.cssText =
      'position:fixed;box-sizing:border-box;border-radius:50%;' +
      'left:' + Math.round(x - 30) + 'px;top:' + Math.round(y - 30) + 'px;' +
      'width:60px;height:60px;pointer-events:none;z-index:2147483647;' +
      'background:rgba(120,120,120,0.4);border:2px solid rgba(255,255,255,0.85);' +
      'opacity:1;transform:scale(0.4);' +
      'transition:transform 0.55s cubic-bezier(0.2,0.6,0.3,1),opacity 0.55s ease-out;';
    host.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'scale(1.2)';
      el.style.opacity = '0';
    });
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 700);
    const stray = document.querySelectorAll('[data-parade-touch]');
    if (stray.length > 6) stray[0].remove();
  } catch (_) {}
}

window.addEventListener('touchstart', (e) => {
  lastTouchAt = Date.now();
  const t = e.touches && e.touches[0];
  if (t) showTouchIndicator(t.clientX, t.clientY);
}, { capture: true, passive: true });

window.addEventListener('mousedown', (e) => {
  // Skip the compatibility mouse event that follows a synthesized tap.
  if (Date.now() - lastTouchAt < 800) return;
  showTouchIndicator(e.clientX, e.clientY);
}, { capture: true, passive: true });

window.addEventListener('wheel', (e) => {
  try {
    if (e.ctrlKey) return; // pinch-zoom → leave to the page/browser
    const dx = e.deltaX || 0;
    const dy = e.deltaY || 0;
    if (Math.abs(dx) <= Math.abs(dy)) return; // vertical → page scrolls natively
    // If the page can pan horizontally, don't steal the gesture.
    const doc = document.documentElement;
    const body = document.body;
    const contentW = Math.max(doc ? doc.scrollWidth : 0, body ? body.scrollWidth : 0);
    if (contentW > window.innerWidth + 1) return;
    const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 400 : 1);
    ipcRenderer.send('views:swipe', { deltaX: dx * unit });
  } catch (_) {}
}, { passive: true });
