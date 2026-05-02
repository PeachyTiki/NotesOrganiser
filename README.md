# Notes Organiser

A desktop meeting notes app built with Electron, React, and Tailwind CSS. Organises notes by customer and recurring meeting, exports to PDF/Word/PNG, and generates AI-ready context prompts for LLM summarisation.

## Features

- **Recurring meetings** — Link notes to a jour fixe or recurring meeting series. Open topics, action items, and resources carry forward automatically to each new session.
- **Rich content sections** — Text, Notes (AI transcript), Topics, Action Items, Decisions, Risks & Blockers, Resources & Links, Bar/Pie/Line charts, and Gantt timelines.
- **Export** — PDF (real text, not image), Word (.docx), and PNG. Bulk ZIP export from the Library at customer, meeting, or full-library level.
- **AI integration** — Download a structured JSON prompt for any section or the full meeting, feed it to ChatGPT / Claude / Gemini with your transcript, and import the response back in one click. Output language follows the per-note language setting.
- **AI context export** — Export the full history of a customer, recurring meeting, or single note as a JSON prompt for an LLM to generate a status report, list open topics, and answer follow-up questions.
- **Library** — Search across titles, customers, content, and participants. Filter by date range. Inline action item status toggling without opening the editor.
- **Templates** — Custom banner colour, logo, font, and colour palette per export theme.
- **Section layout presets** — Save a section arrangement as a named preset and apply it to any new note.
- **Dark mode** — Full dark mode with configurable accent colour.
- **Local-only** — All data is stored in `localStorage`. Nothing leaves your machine.

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
| Canvas capture | html2canvas |
| Icons | Lucide React |

## Getting Started

```bash
# Install dependencies
npm install

# Run in development (browser)
npm run dev

# Run as Electron app
npx electron .

# Build installer (Windows)
npm run electron:build
```

The installer will be output to `release/Notes Organiser Setup 1.0.0.exe`.

## Project Structure

```
src/
  components/
    library/        # Library page (browse, search, bulk export)
    meetings/       # Editor, preview, section components
      sections/     # Individual section types
    templates/      # Template editor
  context/          # AppContext — global state + localStorage persistence
  utils/            # Export (PDF, Word, ZIP), AI prompt builders, i18n
electron/           # Main process + preload
public/             # App icons
```

## Data & Backup

All notes are stored in the browser's `localStorage` under the key `notes_organiser_v1`. Use **Settings → Backup** to export a full JSON backup and **Restore** to import it. The backup includes all notes, templates, recurring meetings, and settings.

## License

MIT — see [LICENSE](LICENSE).
