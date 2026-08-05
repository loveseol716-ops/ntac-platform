import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(
  ({ command }) => ({
    plugins: [react()],

    base:
      command === 'build'
        ? '/ntac-platform/'
        : '/',

    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
    },
  }),
)