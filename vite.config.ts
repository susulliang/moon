import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden',
  },
  server: {
    // Avoid watching large non-source dirs (prevents inotify ENOSPC in sandboxed envs)
    watch: {
      ignored: [
        '**/.pnpm-store/**',
        '**/.git/**',
        '**/node_modules/**',
      ],
    },
    host: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths()
  ],
})
