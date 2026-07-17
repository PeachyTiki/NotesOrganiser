import { AlertTriangle } from 'lucide-react'

// Shared "leaving with unsaved changes?" prompt — originally only shown when
// closing a meeting note, now reused anywhere with local unsaved edits
// (Settings, Templates). `canSave`/`invalidMessage` let a screen block the
// "save and leave" option when the in-progress edit isn't valid yet (e.g. a
// template with no name), instead of silently discarding or silently saving
// something invalid.
export default function UnsavedChangesModal({
  onCancel,
  onDiscard,
  onSave,
  saveLabel = 'Save',
  canSave = true,
  invalidMessage,
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-md" onClick={onCancel} />
      <div className="relative dropdown-panel rounded-2xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Unsaved Changes</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          {canSave
            ? `Your changes have not been saved. ${saveLabel} to keep them, or leave without saving.`
            : 'Your changes have not been saved, and can\'t be saved yet.'}
        </p>
        {!canSave && invalidMessage && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-start gap-1.5">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {invalidMessage}
          </p>
        )}
        <div className="flex gap-2 justify-end flex-wrap">
          <button className="btn-ghost text-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="text-sm px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
            onClick={onDiscard}
          >
            Leave without saving
          </button>
          {canSave && (
            <button className="btn-primary text-sm" onClick={onSave}>
              {saveLabel} and leave
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
