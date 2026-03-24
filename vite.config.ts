import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'vendor-react';
          }

          if (id.includes('react-router') || id.includes('@remix-run/router')) {
            return 'vendor-router';
          }

          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query';
          }

          if (id.includes('firebase') || id.includes('@supabase/supabase-js')) {
            return 'vendor-data';
          }

          if (id.includes('@portone/')) {
            return 'vendor-payments';
          }

          if (id.includes('@google/genai') || id.includes('jspdf')) {
            return 'vendor-ai';
          }

          if (id.includes('motion')) {
            return 'vendor-motion';
          }

          if (id.includes('lucide-react')) {
            return 'vendor-ui';
          }

          return 'vendor-misc';
        },
      },
    },
  },
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
