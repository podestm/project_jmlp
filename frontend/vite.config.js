import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/races': {
        target: 'http://backend:8000',
        changeOrigin: true
      },
      '/racers': {
        target: 'http://backend:8000',
        changeOrigin: true
      },
      '/clubs': {
        target: 'http://backend:8000',
        changeOrigin: true
      },
      '/registrations': {
        target: 'http://backend:8000',
        changeOrigin: true
      },
      '/posts': {
        target: 'http://backend:8000',
        changeOrigin: true
      },
      '/season-results': {
        target: 'http://backend:8000',
        changeOrigin: true
      },
      '/visitor-log': {
        target: 'http://backend:8000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://backend:8000',
        changeOrigin: true
      },
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true
      },
      '/health': {
        target: 'http://backend:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-[hash]-${Date.now()}.[ext]`
      }
    }
  }
})
