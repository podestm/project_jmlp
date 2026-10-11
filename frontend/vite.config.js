import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fontPreload from './vite/fontPreload.js'

export default defineConfig({
  plugins: [react(), fontPreload()],
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
      // API se seznamem dokumentů; SPA route je /dokumenty (česky)
      '/documents': {
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
        // Názvy nechává na Vite (`assets/[name]-[hash].[ext]`) - hash obsahu
        // cache stejně invaliduje, takže nezměněný chunk si drží URL.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          dexie: ['dexie'],
          // pdfmake i s fonty je velký; načte se až při prvním generování
          // výsledkové listiny, ne s celou timekeeper sekcí.
          pdf: ['pdfmake']
        }
      }
    }
  }
})
