import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/test/**',
        'src/main.jsx',
        // Statická data a čistě prezentační obaly bez větvení; pokrytí by tu
        // měřilo jen to, že se soubor načetl.
        'src/**/*.test.{js,jsx}',
      ],
    },
  },
});
