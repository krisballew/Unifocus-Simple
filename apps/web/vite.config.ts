import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    // Proxy API requests to the backend in development
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
        // Ensure headers including Authorization are passed through
        headers: {
          Connection: 'keep-alive',
        },
        // Allow Authorization headers
        bypass: undefined,
      },
    },
  },
  define: {
    // Fix for amazon-cognito-identity-js and other Node.js packages
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Polyfill Node.js built-ins for browser
      buffer: 'buffer',
      process: 'process/browser',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});
