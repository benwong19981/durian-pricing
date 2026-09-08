# SL Durian Price Board

A daily pricing tool for SL Durian (尚榴一品). Enter this morning's buying prices for
whole fruit (by grade) and pulp (by variety), get back selling prices, save today's
figures into a running Excel database, and export a branded price card PNG to post to
customers. Works offline once installed. See [`../files/SPEC.md`](../files/SPEC.md)
for the full functional spec this implements.

## Develop

```bash
npm install
npm run dev       # http://localhost:5173, live reload
npm test          # pricing.ts unit tests (vitest)
```

`npm run dev` does **not** register the service worker or exercise the offline path —
that only exists in the production build. To test the installed/offline experience
locally:

```bash
npm run build
npm run preview   # serves dist/ at http://localhost:4173
```

Then open DevTools → Application → Service Workers, confirm it's activated, and try
"Offline" in the Network tab.

## Regenerating fonts and icons

Both are checked into `public/` as static files (the spec calls for real files, not
ones generated at runtime), but they're not written by hand:

- **`public/fonts.css`** embeds a small, curated Barlow Semi Condensed + Noto Sans SC
  subset as base64 `data:` URIs — just enough glyphs to cover every fixed
  English/Chinese string in the app plus the seed variety names, so the UI and the
  price card render correctly with zero network requests. If you add new fixed
  Chinese copy (not owner-typed variety names — those already fall back to Google
  Fonts when online, or the system font when not), regenerate this file: see the
  character list and `text=` request in the git history of this file, or just widen
  it and re-run the same Google Fonts `text=` trick.
- **`public/icon-192.png`**, **`icon-512.png`**, **`icon-180.png`** are baked from
  `public/logo-mark.png` onto the brand green. Regenerate with:

  ```bash
  npm run icons
  ```

  (uses `sharp`, a dev dependency, via `scripts/make-icons.mjs`)

## Deploy

Any static host with HTTPS works — the File System Access API and service worker
installability both require a secure origin. GitHub Pages and Netlify are the least
trouble.

```bash
npm run build
```

This runs the TypeScript check, the Vite build, and `scripts/build-sw.mjs`, which
regenerates `dist/sw.js` with a precache list matching the exact files that build
produced (Vite content-hashes filenames, so this has to happen after the build, not
before). Deploy the contents of `dist/` as-is.

### GitHub Pages

1. Push `dist/`'s contents to a `gh-pages` branch (or use a GitHub Action that runs
   `npm run build` and publishes `dist/`).
2. In the repo Settings → Pages, set the source to that branch.
3. The app uses relative paths throughout (`base: "./"` in `vite.config.ts`), so it
   works whether it's served from the domain root or a `/reponame/` subpath — no
   config changes needed either way.

### Netlify

1. Connect the repo, or drag-and-drop the `dist/` folder in the Netlify dashboard.
2. Build command: `npm run build`. Publish directory: `dist`.

### After deploying

Open the deployed URL on the Android phone in Chrome. Chrome should offer to install
it (or use the menu → "Add to Home screen"); it installs standalone with the durian
icon. On desktop, look for the install icon in Chrome's address bar, or use the
in-app "Install app" button that appears once the browser is ready to offer it.

## Browser support notes

- **Save / Save as / Open database** use the File System Access API (Chrome/Edge on
  desktop and Android). Where it's unavailable (Firefox, Safari, Chrome on Android for
  the *open* dialog specifically falls back to a plain file picker), Save and Save as
  download an updated copy of the workbook instead of writing in place — the database
  bar in the header always states which mode is active.
- Everything else (the whole-fruit/pulp calculators, the price card PNG, CSV export,
  print, offline use) works the same in every modern browser.

## Project layout

```
src/
  state.ts        model, defaults, seed data
  pricing.ts       the pricing formulas — pure, unit tested
  storage.ts       IndexedDB: app state + the persisted file handle
  db.ts            Save/Save as/Open orchestration (File System Access + fallback)
  excel.ts         workbook read, merge, write, CSV export
  card.ts          the canvas price card (logo keying, layout, export)
  ui/              tables, mobile cards, control strip, toasts, wiring
public/
  logo-full.jpg, logo-mark.png, icon-*.png, manifest.json, fonts.css
scripts/
  make-icons.mjs   bakes the PNG icons from the logo (dev-time only)
  build-sw.mjs     writes dist/sw.js after each build with the real file list
```
