import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Replace 'project-name' with your actual GitLab repository name
  // If you are using a custom domain or a user/group page (at the root), 
  // you can set this to '/'
  base: '/sbs-media/', 
})