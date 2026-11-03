# PCT Admin

A headless-CMS admin UI prototype built with React, Vite, and Tailwind CSS. All data is mocked and persisted to `localStorage`. On Vercel it can also be shared between browsers through a Vercel Blob store (see below).

## Sections

- **Content** — entries table with saved views (Status / Content type), filters, and a detail/edit page.
- **Catalogue** — category-driven items table with the same sidebar pattern, bulk actions, and a detail/edit page.
- **Content types** — schema list with an inline field editor (add/remove/rename fields).
- **Media** — asset library with List/Icons view toggle.
- **Settings** — workspace general settings, users & roles, API keys.

## Running locally

```bash
npm install
npm run dev
```

## Shared workspace on Vercel

Without a store the app keeps everything per browser. To make every browser show the same content:

1. In the Vercel project, open **Storage**, create a **Blob** store and connect it to this project (this adds `BLOB_READ_WRITE_TOKEN`). Redeploy.
2. Open the site first in the browser whose content you want to keep. It uploads that content as the shared workspace. Other browsers then load it automatically.

`api/workspace.js` stores the whole workspace as one JSON file in the store. Saves are conditional on the version the browser last saw, so a browser that is out of date gets a prompt (use the shared copy, or keep its own) instead of overwriting another browser's changes. The request limit on Vercel is about 4.5 MB, which caps the total size of content plus uploaded images. Anyone with the site URL can read and change the shared workspace. `npm run dev` serves the same API with an in-memory store that resets when the server restarts.

Settings → Data exports the workspace to a file and imports one (importing also replaces the shared copy).
