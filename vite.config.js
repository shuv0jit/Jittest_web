import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensures all assets are loaded using relative paths, 
  // which helps prevent "Not Secure" mixed-content warnings.
  base: './', 
  build: {
    // Explicitly set the output directory to match your Vercel settings
    outDir: 'dist',
    // Ensures small assets are inlined to reduce the number of 
    // server requests, helping with slow ISP connections.
    assetsInlineLimit: 4096, 
  },
  server: {
    historyApiFallback: true,
  }
})