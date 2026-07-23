# Notes Organiser

A desktop meeting notes app — organise notes by customer and recurring meeting, export to PDF/Word, sync to SharePoint or any cloud folder, and generate AI-ready prompts from your transcripts.

---

## Install

### Windows

1. Go to **[Releases](https://github.com/PeachyTiki/NotesOrganiser/releases/latest)**
2. Download **`Notes Organiser Setup 3.0.0.exe`**
3. Run the installer and follow the prompts
4. Launch **Notes Organiser** from the Start Menu or Desktop shortcut

### Mac

1. Go to **[Releases](https://github.com/PeachyTiki/NotesOrganiser/releases/latest)**
2. Download **`Notes Organiser-3.0.0-universal.dmg`**
3. Open the DMG, drag **Notes Organiser** into your **Applications** folder
4. **First launch only:** right-click the app → **Open** → click **Open** in the dialog
   *(macOS blocks unsigned apps by default — you only need to do this once)*
5. After the first launch, it opens normally like any other app

### This build isn't signed/notarized

Windows SmartScreen, antivirus, or corporate endpoint protection (e.g.
CrowdStrike) may warn about or block it as an unrecognized publisher —
choose **"More info" → "Run anyway"**, or ask your IT team to allow it.

macOS Gatekeeper will say it "cannot be verified" and refuse to open
it. Run `xattr -cr "/Applications/Notes Organiser.app"` in Terminal,
then open the app normally (or right-click → Open → confirm).

---

## Features

- **Recurring meetings** — Link notes to a recurring series. Open topics, actions, and resources carry forward to each new session automatically.
- **Customers & Projects** — Organise meetings under customers or projects (with sub-entities one level deep). Filter by type, assign emojis.
- **Misc Meetings** — A catch-all folder for one-off meetings not tied to any customer or project.
- **Rich sections** — Text, Notes (AI transcript), Topics, Tasks, Decisions, Risks, Resources, Bar/Pie/Line charts, Gantt timelines.
- **Export** — PDF (real text), Word (.docx), PNG. Bulk ZIP from the Library.
- **Folder Sync** — Automatically export PDFs to any local or cloud-synced folder (OneDrive, SharePoint, Dropbox) after every save.
- **AI integration** — Download a structured JSON prompt for any note or section, paste your transcript, and import the AI response back in one click.
- **Templates** — Custom banner, logo, font, and colour palette per export theme. Organise templates into folders (drag to file, two levels deep) — the template picker used when writing a note mirrors the same folder structure.
- **Automatic daily backup to a folder of your choice** — in addition to the built-in local safety-net backup, pick any folder in Settings and Notes Organiser writes a full JSON backup there once a day, overwriting the previous one each time.
- **Unsaved-changes protection everywhere** — Settings and Templates now prompt to save or discard before you navigate away, the same way meeting notes already do.
- **Task management** — A dedicated Tasks page across every meeting, with a floating always-on-top widget for at-a-glance Today/This Week/All views, customer/type filters, and optional desktop notifications summarising open, overdue, and due-today counts on a schedule you set.
- **Dark mode** — Full dark mode with a configurable accent colour that's automatically kept readable (contrast-safe against whatever shade you pick) in both themes.
- **Glassy, translucent UI** — A consistent frosted-glass look across every page, modal, and popup window.
- **Local-only** — All data lives in `localStorage`. Nothing leaves your machine.

---

## Tech Stack

| Layer | Library |
|---|---|
| Desktop shell | Electron 41 |
| UI framework | React 18 + Vite 4 |
| Styling | Tailwind CSS 3 |
| Drag & drop | @dnd-kit |
| PDF export | jsPDF |
| Word export | docx |
| ZIP export | JSZip |
| Icons | Lucide React |

---

## Build from Source

```bash
npm install

# Development (browser only)
npm run dev

# Build installer
npm run electron:build
# → release/Notes Organiser Setup 3.0.0.exe  (Windows)
# → release/Notes Organiser-3.0.0-universal.dmg  (Mac — requires macOS runner)
```

Releases are built automatically via GitHub Actions on every version tag push. The workflow builds Windows on `windows-latest` and Mac on `macos-latest` and attaches both to a GitHub Release.

---

## Data & Backup

All data is stored in `localStorage` under the key `notes_organiser_v1`. Use **Settings → Backup** to export a full JSON snapshot and **Restore** to import it. Backups include all notes, templates, recurring meetings, and settings.

---

## License

MIT
