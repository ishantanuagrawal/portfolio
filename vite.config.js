// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/portfolio/', // Replace 'portfolio' with your exact repo name
  plugins: [react()],
})
