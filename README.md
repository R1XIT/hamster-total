# Hamser Total

A desktop hamster companion for Windows. It sits on your screen, periodically
scans folders you configure using the built-in Windows Defender engine, and
asks for your explicit consent before deleting anything it flags as malware.
You can also drag any file straight onto the hamster to send it to the
Recycle Bin — the hamster "eats" it.

## What it does

- Runs as a small, transparent, always-on-top window with an animated
  hamster sprite (idle, sleeping, dragging, scanning, eating states).
- On a configurable schedule, scans the folders you've added in Settings via
  `MpCmdRun.exe` (Windows Defender's command-line scanner) and reads the
  results back with `Get-MpThreatDetection`.
- If Defender reports a threat, the hamster shows a speech-bubble prompt and
  **waits for you to confirm** before deleting anything — nothing is removed
  automatically.
- Drag-and-drop: drop any file onto the hamster window and it is moved to
  the Windows Recycle Bin (not permanently deleted), after a guard check
  that refuses to touch protected system paths.
- Lives in the system tray with a menu for "Scan now", "Settings", "Launch
  at Windows startup", and "Exit" (menu labels are in Russian in the current
  build: Сканировать сейчас / Настройки / Запускать при старте Windows /
  Выход).
- A Settings window lets you add/remove scan folders and adjust the scan
  interval and the idle/sleep timeout.

## Requirements

- Windows 10/11 with Windows Defender enabled (the app shells out to
  `MpCmdRun.exe` and PowerShell's `Get-MpThreatDetection`; it will not detect
  threats on a machine without Defender active).
- [Node.js](https://nodejs.org/) 18+ and npm.
- Python 3 with `pillow` and `numpy` — only needed once, to regenerate the
  processed sprite assets from the raw GIFs in `sprites/`. The repository
  already ships the processed output in `assets/processed/`, so most
  contributors will never need to run this step.

## Building and running from source

```bash
npm install

# One-time only, and only if you've changed the raw GIFs in sprites/:
#   pip install pillow numpy
#   python scripts/process_sprites.py

npm run build
npm run start
```

`npm run build` compiles the TypeScript sources with `tsc`. `npm run start`
rebuilds and launches the compiled app with Electron.

### Running the tests

```bash
npm test                                  # TypeScript/Vitest unit tests
pip install pillow numpy pytest
pytest scripts/test_process_sprites.py -v # sprite-processing script tests
```

## Packaging a distributable build

```bash
npm run package-app
```

This runs `tsc` and then `electron-builder`, producing an NSIS installer
(`.exe`) for Windows under `release/` (gitignored). Package metadata,
included files, and the output directory are configured in the `"build"`
block of `package.json`.

## Configuration

Settings (scan folders, scan interval, sleep timeout, launch-at-startup) are
stored as JSON in the app's user-data directory and are edited through the
tray's "Settings" window — there is no need to hand-edit config files.

## Graphics attribution

The hamster sprite animations bundled in `sprites/` (raw GIFs) and
`assets/processed/` (processed WebP + manifest used at runtime) were **found
and added by the project owner from third-party sources** (open sources /
meme sites such as Tenor), in a visual style associated with the existing
"ChomikBox" hamster character. They were **not created for this project**,
no claim of original authorship is made over them, and they were not
generated or scraped by the coding assistant that built this app — the
assistant only wrote the pipeline (`scripts/process_sprites.py`) that
converts GIFs already placed in the repo by the owner into the WebP assets
the app loads.

**If you intend to publish or redistribute a build of this app**, you are
responsible for determining whether you have the rights to redistribute
these graphics, and for replacing them with your own art or securing
permission if you do not. Nothing in this repository or its MIT license (see
`LICENSE`) grants or implies redistribution rights for the sprite assets.
