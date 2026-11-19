# MultiBrowser

A lightweight, dependency-free mobile browser emulator for testing webapps side by side. Open multiple device panels at once, each with its own URL and screen size (including flip and fold devices), arranged horizontally with scrolling when they exceed the viewport.

## Features

- **Multiple visible panels side by side** – run several "tabs" simultaneously instead of switching between them.
- **Horizontal scrolling workspace** – add as many panels as you need; scroll to see them all.
- **Per-panel device sizes** – mix different devices in the same view.
- **Device presets** including phones, tablets, and foldables:
  - Flip phones: Galaxy Z Flip 5/6 (inner/cover), Motorola Razr+ (inner/cover)
  - Foldables: Galaxy Z Fold 5/6, Pixel Fold, OnePlus Open, Surface Duo
  - Common phones/tablets: iPhone, Pixel, Galaxy S, iPad, etc.
- **Custom screen sizes** and **portrait/landscape** orientation per panel.
- **Global zoom** to scale device frames for easier viewing.
- **Per-panel controls**: URL bar, reload, rotate, close.
- Works with **local and online** URLs.

## Usage

No build step required.

1. Open `index.html` directly in a browser, **or** serve the folder locally (recommended for testing local dev servers):

   ```bash
   # from this directory
   python3 -m http.server 8080
   # then open http://localhost:8080
   ```

2. Enter a URL (e.g. `http://localhost:3000` or `https://example.com`).
3. Choose a device preset (or **Custom size**) and orientation.
4. Click **Add panel**. Repeat to add more panels side by side.
5. Use the panel URL bar, rotate, reload, or close controls as needed.
6. Adjust **Zoom** to fit more panels on screen.

## Notes & limitations

- **Iframe restrictions:** Some websites block being embedded in iframes via `X-Frame-Options` or `Content-Security-Policy` (`frame-ancestors`). Those pages cannot be displayed in this tool. Local development servers and sites that allow embedding work best.
- **Not a full device emulator:** This tool emulates viewport dimensions (CSS size) for layout testing. It does not emulate device-specific APIs, user agents, touch hardware, or browser engines. For high-fidelity emulation, use browser DevTools device mode or platform emulators alongside this tool.
- **`localhost` URLs:** When you serve MultiBrowser itself over HTTP, you can load `http://localhost:*` targets in panels (subject to the target app's own frame/CORS behavior). If you open `index.html` as a `file://` page, some browsers restrict mixed contexts.

## Project structure

- `index.html` – app markup
- `styles.css` – UI and layout styles
- `app.js` – device presets and panel logic
- `README.md` – this file
