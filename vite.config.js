import { defineConfig } from 'vite';

export default defineConfig({
  // Set the root directory for Vite
  root: '.',
  
  // Public directory for static assets
  publicDir: 'output',
  
  // Development server configuration
  server: {
    port: 3000,
    open: true, // Automatically open browser
    cors: true
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});