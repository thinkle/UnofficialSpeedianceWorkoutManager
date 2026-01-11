Welcome to this project. We have a few convenience directories that are in .gitignore that you should be able to ignore...

_To Ignore_

- toms-mitm-code/ - this is code I had used in the past to run Speediance's android app in an environment where I can watch API calls.
- cron_sync/ - this is a standalone script I use for a cron job I use to sync workouts periodically. Unneeded.

## About This App

This is a standalone web app that allows you to manage Speediance workouts. It interacts with Speediance's API to fetch and upload workout data.
The app is currently built using Python and Flask + hand-rolled JavaScript.
I would like to modernize it to be more maintainable and to avoid python. My goal is a netlify-hostable static site with a serverless backend (ideally netlify functions).

That means a refactor would:

- Move front-end code to a modern framework (React)
- Move back-end code to serverless functions (Netlify Functions -- as thin a layer as possible; if we can get away with no backend, even better)
- Move caching of speediance-related data into the browser as much as possible (IndexedDB, localStorage, etc). We do NOT want to commit or save any proprietary Speediance data to any server or source control we control.

We have just created a new git branch called node-refactor where we will be working on this effort. You can contribute as you go and should make incremental progress with commits along the way as you test and develop.

You should track your progress in a markdown file called REFACTOR_NOTES.md in the root of the project. This will help us keep track of what has been done and what still needs to be done.

The goal is a fully working refactored app in the node-refactor branch that can be merged back into main when complete.
The other goal is that this is a standalone web app that can be hosted on netlify and deployed _without_ us touching or controlling any user data. Ideally we don't even relay data through our own servers.

When we are done, we should have a branch with...

- no remaining python code
- complete working functionality
- clean, modular, component-based design that is maintainable and easy to iterate on.
- no proprietary Speediance data stored on our servers or in source control
- ideally no "Speediance" branding or proprietary names in the app at all.
- easy deployment to netlify as a static site with serverless functions.

## Operating Plan

- React is required for the new front-end (use Vite for the scaffold).
- Netlify is the target host; keep build + deploy assumptions aligned with Netlify.
- Move the existing Python app into `legacy-python/` as reference and delete it once the new app is complete.
- Do not persist proprietary Speediance data on any server or in source control; prefer in-browser storage.
- Work in small, incremental commits and log progress in `REFACTOR_NOTES.md`.
