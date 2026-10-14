# PickleSocial

PickleSocial is a mobile-friendly pickleball community app for live rankings, match submissions, challenges, tournaments, chat, and player statistics.

## Run locally

Serve the repository with any static HTTP server, then open the local URL in a browser. For example:

```bash
python3 -m http.server 8000
```

The app reads its public Supabase connection values from `config.js` and its public Cloudflare Turnstile site key from `auth-config.js`. Never place a Supabase secret key or Turnstile secret in browser files.

## Main files

- `index.html` contains the application views and dialogs.
- `app.js` contains application state, Supabase integration, and UI behavior.
- `styles.css` contains the core visual design.
- `pwa.js`, `pwa.css`, `sw.js`, and `manifest.webmanifest` provide the installable app experience.
