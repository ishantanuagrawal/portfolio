import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // This ensures modern JS features like import.meta.glob 
    // are supported in the production build, fixing the 
    // "import.meta is not available" warning.
    target: 'esnext'
  },
  // This base path matches your GitLab repository: ishantanuagrawal-portfolio
  // Note: If you point a custom domain (e.g., sbsmedia.in) to this site later,
  // you will need to change this base back to '/'
  base: '/', 
})