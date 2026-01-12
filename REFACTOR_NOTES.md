# Refactor Notes

## Decisions
- React + Vite for the new frontend.
- Netlify as the target host (static site + Netlify Functions).
- Move the legacy Python app into `legacy-python/` for reference during migration.
- No server-side persistence of proprietary Speediance data; keep storage in-browser.

## Planned Phases
1. Move legacy Python app into `legacy-python/` and set up the React scaffold.
2. Identify and map legacy routes/features to new React routes/components.
3. Implement API access via Netlify Functions only where strictly required.
4. Migrate core flows first: auth, library, workout builder, calendar, history.
5. Replace legacy assets and clean up; remove `legacy-python/` when complete.

## Route Map (Initial)
- `/` Dashboard
- `/library` Exercise library
- `/library/:exerciseId` Exercise detail
- `/exercise/:exerciseId` Exercise detail (compat route)
- `/history` History list
- `/history/:sessionId` History detail
- `/create` Workout builder
- `/settings` Settings

## Dev Notes
- Auth now runs through Netlify Functions at `/.netlify/functions/auth-login` and `/.netlify/functions/auth-logout`.
- For local auth testing, run `netlify dev` from the repo root (Netlify CLI required).

## Progress Log
- 2026-01-11: Added operating plan to `AGENTS.md`. Starting legacy move + React scaffold.
- 2026-01-11: Moved Python app into `legacy-python/`, added Vite React scaffold in `web/`, and added `netlify.toml`.
- 2026-01-11: Added routing shell, placeholder pages, and base visual system for the React app.
- 2026-01-11: Added auth scaffolding (client state + Netlify login/logout functions) and updated Settings UI.
- 2026-01-11: Added Speediance proxy function, library fetch with local cache, and exercise detail integration.
- 2026-01-11: Added auth guard + unauthorized handling for library fetches.
- 2026-01-11: Added English title preferences for library data and enforced Accept-Language in proxy.
