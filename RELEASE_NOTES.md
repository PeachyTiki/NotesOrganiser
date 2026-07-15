## Install

- **Windows** — download the `.exe` and run the installer
- **macOS** — download the `.dmg`, open it and drag **Notes Organiser** into **Applications**

This build isn't code-signed, so Windows SmartScreen, antivirus, or
corporate endpoint protection (e.g. CrowdStrike) may warn about or
block it as an unrecognized publisher. If you trust the source,
choose **"More info" → "Run anyway"** on the SmartScreen prompt, or
ask your IT team to allow it.

Similarly, this build isn't notarized by Apple, so macOS Gatekeeper
will say "Apple could not verify... is free of malware" and refuse
to open it. To run it anyway: open Terminal and run
`xattr -cr "/Applications/Notes Organiser.app"`, then open the app
normally. (Or: right-click the app → Open → confirm; or on newer
macOS, System Settings → Privacy & Security → "Open Anyway".)

---
