import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
// Staré CSS (ve vrstvě legacy) a po něm Modrá stopa – nové styly mimo vrstvu vyhrají.
import './assets/styles/main.css'
import './styles/ms/index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore registration errors to avoid blocking the app startup.
    });
  });
}
