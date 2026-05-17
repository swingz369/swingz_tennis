'use client';

/**
 * Offline Page
 *
 * Shown when the user is offline and tries to navigate to a page
 * that isn't cached. Served by the PWA service worker.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md text-center">
        {/* Offline Icon */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-amber-100 p-6">
            <svg
              className="h-16 w-16 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 5.636a9 9 0 010 12.728m-2.829-9.9a5 5 0 010 7.07M8.464 8.464a5 5 0 000 7.07m-2.828-9.9a9 9 0 000 12.728"
              />
              <line x1="1" y1="1" x2="23" y2="23" strokeWidth={2} />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1 className="mb-2 font-sans text-2xl font-bold text-gray-900">
          Keine Internetverbindung
        </h1>
        <p className="mb-8 text-gray-600">
          Du bist momentan offline. Die App funktioniert nur mit einer aktiven Internetverbindung.
          Bitte prüfe deine Verbindung und versuche es erneut.
        </p>

        {/* Retry Button */}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 font-medium text-white transition-colors hover:bg-brand-dark"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Erneut versuchen
        </button>

        {/* Cached Pages Info */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-4 text-left">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Letzte besuchte Seiten</h2>
          <p className="text-sm text-gray-500">
            Einige zuvor besuchte Seiten könnten noch verfügbar sein. Gehe in deinem Browser zurück
            oder versuche eine andere Seite aufzurufen.
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-gray-400">SwingZ Tennis Club Management</p>
      </div>
    </div>
  );
}
