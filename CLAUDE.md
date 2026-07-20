# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Notes Organiser is an Electron desktop app (React + Vite frontend) for organising meeting notes by customer/project and recurring meeting, exporting to PDF/Word/PNG, auto-syncing exports to local/cloud folders, and generating AI-ready prompts from transcripts. All data is local — no backend, no network calls for app data.

## Commands

```bash
npm install

npm run dev              # Vite dev server — browser only, no Electron shell.
                         # window.electronAPI is undefined here (see below).

npm run build            # Vite build → dist/

npm run electron:build   # build + electron-builder → installer in release/
                         # Windows: NSIS .exe   Mac: universal .dmg (needs a macOS host)
```

There is **no test suite, linter, or typechecker** configured. `npm run electron:build` is the only real verification gate. Releases are cut by CI (`.github/workflows/build.yml`) on any pushed tag matching `v*` or `*.*.*`; the workflow builds Windows + Mac and attaches both to a GitHub Release. Bump the version in `package.json` (and the README download links) when releasing.

## Architecture

### Two processes, one bundle

- **Main process** — `electron/main.cjs` (`.cjs` because `package.json` is `"type": "module"`). Owns all windows and every filesystem operation (backups, folder sync, folder picker). The renderer never touches `fs` directly.
- **Preload** — `electron/preload.cjs` exposes a single `window.electronAPI` object over `contextBridge` (sandboxed, `contextIsolation: true`). Every renderer↔main interaction goes through a method defined here. **When adding an IPC channel you must touch three files:** `main.cjs` (handler), `preload.cjs` (bridge method), and the renderer caller.
- **Renderer** — one Vite bundle (`src/main.jsx`) loaded by every window. `vite.config.js` sets `base: './'` so `file://` loading works in the packaged app.

### One bundle, three window roles

`src/main.jsx` inspects `?widget=` in the URL and mounts a different React root:
- no query → `App` (the full app, the only window with real state)
- `?widget=tasks` → `TaskWidgetApp` (floating always-on-top task widget)
- `?widget=notePreview` → `NotePreviewApp` (floating note preview)

**Popup windows hold no state of their own.** The main window broadcasts its entire app state over IPC (`broadcastWidgetState`) on every change; popups mirror it via `useRemoteAppState` (`src/widgets/useRemoteAppState.js`). Actions taken in a popup (e.g. marking a task complete) are *relayed* back to the main window as `widget-task-action` messages — the main window is the only place mutations actually happen (see `setTaskStatus` in `AppContext`). Theme (dark/accent) is passed to popups via the query string too, so they paint the right look before the async state hand-off arrives (avoids a wrong-theme flash).

### State: `src/context/AppContext.jsx`

This is the heart of the app. A single `AppProvider` holds the entire application state in one object and is the sole source of mutations (`saveMeetingNote`, `saveCustomer`, `saveTemplate`, etc.). Key points:

- **Persistence** is a `useEffect` that writes the whole state to `localStorage` under `notes_organiser_v1` on every change. This is the ONLY storage — there is no database.
- **`migrateState(raw)`** runs on load and on restore. Every backward-compatible schema change goes here (it back-fills missing fields and rewrites legacy shapes — e.g. old `actionItems` sections → `tasks`, and legacy action items' `task` field → `text`). Old data must keep loading; add migrations here rather than assuming fields exist.
- **`guardedUpdate` / `registerNavGuard`** implement unsaved-changes protection: a screen with pending edits registers a guard that intercepts in-app navigation to prompt save/discard before it unmounts.
- **Backups (two independent mechanisms):** a silent dated safety-net backup written to `Documents/Notes Organiser/Backups` (14-day retention, survives installer/uninstaller since it's outside userData), plus an opt-in single-file daily backup to a user-chosen folder. Both are driven from a `useEffect` in `AppContext` calling `saveAutoBackup`/`writeFile`.

### Folder sync — `src/utils/syncManager.js` + `triggerNoteSync` in AppContext

After a note is saved, `triggerNoteSync` renders it to a PDF buffer and writes it to every matching sync destination. Sync configs have a `level`: `A` (all notes), `C` (one customer), `M` (one recurring meeting), which determines both scope (`noteMatchesSync`) and folder nesting (`notePathParts`). `syncFileMap` tracks the last-written absolute path per note+config+mode so a re-save deletes the stale file before writing the new one (handles renames/moves).

### Data model notes

- **Tasks live in two places:** inside meeting-note sections of `type: 'tasks'`, and as `standaloneTasks`. `src/utils/taskUtils.js` (`buildAllTasks`) flattens both into one uniform list used by the Tasks page and the widget. Task text is the `text` field (NOT `task` — that's the pre-migration name).
- **Customers/projects** are one entity list (`customers`) distinguished by `type`; tasks and notes reference them by free-text `customer` name, so category lookups go through name→type maps (`buildCustomerTypeMap`), not IDs.
- **Templates** define per-export theming (banner, logo, font, palette) and can be filed into `templateFolders` (two levels deep).

### Export & AI

- Exports live in `src/utils/`: `export.js` (orchestration + PNG via html2canvas), `exportPDF.js` (jsPDF, real text), `exportWord.js` (docx). Charts are captured from an off-screen canvas container (`#offscreen-export-canvas`) to avoid grabbing the scaled preview instance.
- `src/utils/aiPrompt.js` builds a structured JSON prompt from a note/section (respecting tone settings + notes-context depth) for the user to paste into an AI tool; the response is imported back in.

## Conventions

- `window.electronAPI?.` is always optional-chained — the app must run in a plain browser (`npm run dev`) where Electron APIs don't exist. Never assume `electronAPI` is present.
- Prefer adding mutations as named methods on `AppContext` rather than calling `setState`/`update` with ad-hoc patches from components.
- UK spelling in user-facing strings ("Organiser", "colour").

## Git, commits & attribution (MANDATORY)

- **Monteo Pietsch is the sole and top creator of this project.** Any authorship/credit that appears in commits, release notes, generated files, or documentation must name Monteo Pietsch and no one else.
- **Never co-author.** Do not add `Co-Authored-By` trailers or any second author to any commit.
- **Never cite Claude or Anthropic.** Do not add "Generated with Claude", AI-attribution lines, `🤖` credit footers, or any Claude/Anthropic mention to commits, PR descriptions, release notes, or files — anywhere, on any push.
- Only commit or push when explicitly asked.
