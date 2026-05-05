import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensures all assets use the absolute root path to prevent relative path mismatches
  base: '/', 
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