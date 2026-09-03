import path from 'path';
import { defineConfig } from 'vite';

// VITE_-prefixed variables are exposed on import.meta.env automatically, from .env.local
// locally and from the deploy environment on Netlify, so no `define` mapping is needed.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
