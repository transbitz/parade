# Parade

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/transbitz/parade?label=download)](https://github.com/transbitz/parade/releases/latest)

An Electron desktop app for testing webapps on multiple mobile device screens **side by side**. Parade shows live Chromium device viewports in a dedicated devices window (launched from a small control window), so you can watch the same app respond on a phone, a foldable, and a tablet at the same time — like several devices marching past in a parade.

## Features

- **Multiple live device screens side by side**, each an independent Chromium view with its own session (cookies, storage and zoom never bleed between panels).
- **True device viewports**: every screen runs at its exact CSS size (`innerWidth × innerHeight` matches the device, e.g. 390×844), while the UI **scales the screen to fit** your window — nothing overflows.
- **Touchscreen emulation**: taps behave like real touch input (like DevTools "Emulate touch screen"), and every tap shows a fading DevTools-style touch indicator.
- **Swipe navigation**: two-finger horizontal swipes (on the workspace or inside a screen), arrow keys, or the bottom scrollbar glide from one device screen to the next.
- **Device presets** including flip and fold phones:
  - **Flip:** Galaxy Z Flip 5/6 (inner/cover), Motorola Razr+ (inner/cover)
  - **Foldables:** Galaxy Z Fold 5/6 (inner/cover), Pixel Fold (inner/cover), OnePlus Open (inner/cover), Surface Duo (single/dual)
  - **Phones/tablets:** iPhone SE/12–15 series, Pixel 7/7 Pro, Galaxy S series, iPad Mini/Air/Pro, Pixel Tablet
  - **Custom sizes** (W×H) and portrait/landscape orientation.
- **User-Agent options** per panel: Default, iPhone, Android, iPad.
- **Panel controls (⋯):** back, forward, reload, rotate, DevTools, duplicate, close, per-panel URL, per-panel device switching.
- **Session persistence:** your workspace and panels are saved and restored automatically.
- Works with **local and online** URLs (`http://localhost:3000`, production sites, …).

## Download

Grab the latest packages from the **[Releases page](https://github.com/transbitz/parade/releases/latest)**:

| Platform | Package |
|---|---|
| Windows (10/11, x64) | `Parade-<version>-win-x64.exe` (installer) |
| macOS (Apple Silicon) | `Parade-<version>-mac-arm64.dmg` |
| macOS (Intel) | `Parade-<version>-mac-x64.dmg` |
| Debian / Ubuntu | `Parade-<version>-linux-amd64.deb` |
| Fedora / RHEL | `Parade-<version>-linux-x86_64.rpm` |
| Arch Linux | `Parade-<version>-linux-x86_64.pkg.tar.xz` |
| Any Linux (universal) | `Parade-<version>-linux-x86_64.AppImage` |

### Install instructions

**Windows** — run the `.exe` installer and follow the wizard (you can choose the install directory).

**macOS** — open the `.dmg` and drag Parade into Applications. The builds are **not code-signed** (no Apple Developer account), so on first launch **right-click → Open** (or *System Settings → Privacy & Security → Open Anyway*) to bypass Gatekeeper.

**Debian / Ubuntu**
```bash
sudo apt install ./Parade-<version>-linux-amd64.deb
```

**Fedora / RHEL**
```bash
sudo dnf install ./Parade-<version>-linux-x86_64.rpm
```

**Arch Linux**
```bash
sudo pacman -U ./Parade-<version>-linux-x86_64.pkg.tar.xz
```

**Any Linux (AppImage)**
```bash
chmod +x Parade-<version>-linux-x86_64.AppImage
./Parade-<version>-linux-x86_64.AppImage
```

## Build from source

Prerequisites: **Node.js 18+** and npm.

```bash
git clone https://github.com/transbitz/parade.git
cd parade
npm ci
npm start            # run from source
```

Package installers for your platform:

```bash
npm run dist:linux   # .deb + .rpm + .AppImage + .pkg.tar.xz
npm run dist:win     # Windows NSIS .exe
npm run dist:mac     # macOS .dmg + .zip
```

All release packages are built automatically by GitHub Actions (see `.github/workflows/release.yml`) whenever a version tag (`v*`) is pushed.

## Project structure

- `main.js` – Electron main process: window management, one `WebContentsView` per device panel, IPC, touch emulation
- `preload.js` – control/display window bridge
- `view-preload.js` – runs inside device pages: forwards horizontal swipes, draws touch indicators
- `src/control.html|css|js` – the small control window (add panels, global navigation)
- `src/display.html|css|js` – the devices window: panels, scaling, carousel scrollbar, persistence
- `build/icon.png` – app icon source (used for all platform packages)
- `test.html` – tall test page used by the dev/test harness
- `web-prototype/` – earlier iframe-based prototype (reference only)

## How it works

Each panel is a real Chromium view owned by the main process and positioned over its on-screen "device wrap". The view is laid out at the **scaled** size (so the whole device fits your window) while a compensating page zoom keeps the CSS viewport at the **true device size** — you get exact `innerWidth`/`innerHeight` with a screen that fits.

## Notes

- **Viewport-focused emulation:** screens emulate device viewport sizes, UA and touch for responsive/layout testing. This is not full device emulation (DPR, sensors and platform APIs are not spoofed).
- **Performance:** each screen is a live Chromium view; many screens can be CPU/memory intensive.

## License

[MIT](LICENSE) © 2026 transbitz
