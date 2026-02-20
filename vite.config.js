import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // This ensures modern JS features like import.meta.glob 
    // are supported in the production build.
    target: 'esnext'
  },
  
  // FIX: This must exactly match your repository name wrapped in forward slashes.
  // If your GitHub repo URL is github.com/username/ishantanuagrawal-portfolio
  // then the base MUST be '/ishantanuagrawal-portfolio/'
  // (If you ever add a custom domain like www.sbsmedia.in, you will change this back to '/')
  base: '/ishantanuagrawal-portfolio/', 
})
