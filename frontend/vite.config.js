import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Set VITE_PORT to request a particular port. When it is occupied, Vite
    // will select the next available one instead of refusing to start.
    port: Number(process.env.VITE_PORT) || 5173,
    strictPort: false,
  },
})
