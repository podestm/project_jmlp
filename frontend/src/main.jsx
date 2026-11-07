import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// Jediné globální styly: Modrá stopa (tokeny, písma, reset). Ostatní je v *.module.css.
import './styles/ms/index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Ignore registration errors to avoid blocking the app startup.
    });
  });
}
