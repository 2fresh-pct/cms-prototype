import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Serves /api/workspace in `vite dev` with an in-memory store (it resets when
// the dev server restarts), so the shared-workspace sync can be tried locally.
// On Vercel the same handler runs as a function and stores to Vercel Blob.
const workspaceApi = () => ({
  name: 'workspace-api',
  configureServer(server) {
    process.env.WORKSPACE_STORE ??= 'memory'
    server.middlewares.use('/api/workspace', async (req, res) => {
      const { default: handler } = await server.ssrLoadModule('/api/workspace.js')
      req.url = req.originalUrl ?? req.url
      await handler(req, res)
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), workspaceApi()],
})
