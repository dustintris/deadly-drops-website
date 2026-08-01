import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the site works at any GitHub Pages project path.
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        basic: resolve(__dirname, 'basic.html'),
        standard: resolve(__dirname, 'standard.html'),
        premium: resolve(__dirname, 'premium.html'),
      },
    },
  },
})
