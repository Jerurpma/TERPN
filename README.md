# TERPN static app checkpoint

This folder is the split version of the previous single-file TERPN checkpoint. It keeps the app local-first by default while adding a backend adapter behind feature flags.

## Structure

- `index.html` — page markup and section layout
- `assets/css/styles.css` — extracted visual design
- `assets/js/main.js` — app bootstrap, state, and event handlers
- `assets/js/data/terpenes.js` — terpene library seed data
- `assets/js/ui/` — rendering, tabs, and toast UI helpers
- `assets/js/services/` — repository and onboarding logic
- `assets/js/adapters/` — local storage adapter and REST backend adapter
- `assets/js/config/` — storage keys and feature flags
- `assets/js/utils/` — small DOM/date/download/id helpers

## Run locally

Because the JavaScript is now split into ES modules, serve the folder instead of opening `index.html` directly from the file system:

```bash
cd terpn_app
npm run serve
```

Then open `http://localhost:4173`.

## Backend feature flags

The app uses local storage unless backend flags are turned on. You can turn them on with URL parameters:

```text
?terpnBackend=1&terpnBackendRead=1&terpnBackendWrite=1&terpnBackendBaseUrl=http%3A%2F%2Flocalhost%3A3000
```

Or store them in the browser console:

```js
localStorage.setItem('terpn.flags.v1', JSON.stringify({
  useBackendAdapter: true,
  backendBaseUrl: 'http://localhost:3000',
  backendReadEnabled: true,
  backendWriteEnabled: true,
  mirrorBackendWritesToLocal: true,
  fallbackToLocalOnBackendError: true
}, null, 2));
```

Expected REST endpoints are currently:

- `GET|PUT|DELETE /api/profile`
- `GET|PUT|DELETE /api/journal`
- `GET|PUT|DELETE /api/signups`
- `GET|PUT|DELETE /api/account`

The backend adapter accepts either a direct JSON response or a wrapped `{ "data": ... }` response. If backend requests fail and `fallbackToLocalOnBackendError` is enabled, the app falls back to local storage.

## Check JavaScript

```bash
cd terpn_app
npm run check
```
