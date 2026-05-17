import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
      '/wiki': 'http://localhost:8080',
      '/bugs': 'http://localhost:8080'
    }
  },
  build: {
    outDir: 'dist',
    target: 'esnext'
  }
})
