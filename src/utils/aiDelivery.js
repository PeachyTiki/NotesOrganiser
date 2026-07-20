// Shared delivery for AI prompts in the "Copy / Paste" family of modes.
//
// aiPromptMode values:
//   'download'       → save the prompt as a .json file (handled at call sites)
//   'clipboard'      → copy the prompt JSON to the clipboard
//   'clipboard-open' → copy to the clipboard AND open a fresh Claude chat, so
//                      the whole hand-off is one click + a paste
//
// We deliberately do NOT automate Claude itself (no scripting/scraping of the
// chat UI — that would breach Anthropic's terms and risk the account). We only
// copy the prompt and open a blank chat; the user pastes it themselves.

export const CLAUDE_NEW_CHAT_URL = 'https://claude.ai/new'

// In the packaged app, window.open is routed to the OS default browser by the
// main process (setWindowOpenHandler → shell.openExternal), which keeps the
// user's existing (SSO) Claude session. In a plain browser it opens a tab.
export function openClaudeNewChat() {
  try {
    window.open(CLAUDE_NEW_CHAT_URL, '_blank', 'noopener')
  } catch {
    // best-effort — never let opening a browser tab break the copy
  }
}

// Copies the prompt to the clipboard and, in 'clipboard-open' mode, also opens
// a new Claude chat. Returns the clipboard write promise so callers can chain
// .then()/.catch() for their own success/error UI.
export function copyPromptToClipboard(json, mode) {
  const p = navigator.clipboard?.writeText?.(json) ?? Promise.resolve()
  if (mode === 'clipboard-open') openClaudeNewChat()
  return p
}
