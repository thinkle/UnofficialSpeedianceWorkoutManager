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
- `/create` Workout builder (new workout)
- `/edit/:workoutCode` Workout builder (edit existing)
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
- 2026-01-11: Rebuilt Builder page layout to mirror legacy UI (library sidebar, filters, advanced tools, modals scaffold).
- 2026-01-11: Started Dashboard + History data wiring and added Builder detail filter scaffolding.
- 2026-01-27: Added full workout CRUD functionality:
  - Added `fetchWorkoutDetail`, `deleteWorkout`, and `saveWorkout` API functions to `workouts.js`
  - Added `/edit/:workoutCode` route for editing existing workouts
  - Added Edit and Delete buttons to workout cards on Dashboard
  - Added "New Workout" button to Dashboard
- 2026-03-08: Added smart equipment filtering with grouped checkboxes:
  - Created `equipmentGroups.js` with configurable equipment groups (Bench Type, Attachments)
  - Implemented smart OR/AND logic: OR within groups, AND between groups
  - Added compatibility rules (adjustable bench matches flat bench exercises)
  - Built `EquipmentFilter` component with expandable sections and selection badges
  - Replaced single equipment dropdown in Builder with multi-select grouped filter
  - Added comprehensive CSS styling for the new filter UI
  - Filter now clearly displays "Within each category uses OR logic. Between categories uses AND logic."
  - Rebuilt Builder component with full workout editing functionality:
    - Load existing workout for edit mode
    - Add/remove exercises from library
    - Add/remove/edit sets per exercise
    - Reorder exercises
    - Save/update workout
    - Import/export JSON
    - Condensed view toggle
