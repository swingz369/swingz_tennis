CenteredModal from swingz. Use via `window.Swingz.CenteredModal` (bundle loaded from the root `_ds_bundle.js`).

CenteredModal — the canonical modal wrapper for SwingZ.

Combines the most common modal patterns into one component:
- Viewport-centering via `min-h-screen flex items-center justify-center` (not just
  `items-center` alone, which centers against the content's own height)
- `p-4` so tall modals have breathing room from the viewport edges
- Body scroll lock (prevents the page behind from scrolling while modal is open)
- Escape key closes the modal
- Overlay click closes the modal (unless `disableOverlayClose`)
- Inner content capped at `max-h-[90vh]` with internal scroll, so forms never
  extend below the viewport

Replaces the 9+ raw `<div className="fixed inset-0 z-50 flex items-center
justify-center bg-black/40">` patterns previously scattered through the app.
