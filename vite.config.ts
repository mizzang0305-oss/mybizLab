import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (
            normalizedId.includes('/src/pages/LandingPage.tsx') ||
            normalizedId.includes('/src/modules/onboarding/page.tsx') ||
            normalizedId.includes('/src/shared/components/CinematicServiceWorld.tsx') ||
            normalizedId.includes('/src/shared/components/ConsultationCinematicScene.tsx') ||
            normalizedId.includes('/src/shared/components/DiagnosisCinemaShell.tsx') ||
            normalizedId.includes('/src/shared/components/ServiceOrbitWorld.tsx') ||
            normalizedId.includes('/src/shared/lib/cinematicScenes.ts') ||
            normalizedId.includes('/src/shared/lib/diagnosisCorridor.ts')
          ) {
            return 'cinematic-experience';
          }

          if (!id.includes('node_modules')) {
            return undefined;
          }

          // Match only the actual react / react-dom / scheduler packages.
          // Avoid accidentally matching scoped packages like @tiptap/react or
          // @fullcalendar/react whose paths also end in /react/.
          if (
            /\/node_modules\/react\//.test(id) ||
            /\/node_modules\/react-dom\//.test(id) ||
            /\/node_modules\/scheduler\//.test(id)
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

          // ── 3D / Cinematic ────────────────────────────────────────────
          if (id.includes('/three/') || id.includes('/three-') || id.includes('vanta')) {
            return 'vendor-3d';
          }

          // ── Animation ─────────────────────────────────────────────────
          if (id.includes('gsap')) {
            return 'vendor-gsap';
          }

          // ── Charts ────────────────────────────────────────────────────
          if (
            id.includes('recharts') ||
            id.includes('victory-vendor') ||
            id.includes('/d3-') ||
            id.includes('d3-shape') ||
            id.includes('d3-scale') ||
            id.includes('d3-interpolate') ||
            id.includes('d3-color') ||
            id.includes('d3-format') ||
            id.includes('d3-time')
          ) {
            return 'vendor-charts';
          }

          // ── Calendar ──────────────────────────────────────────────────
          if (id.includes('@fullcalendar')) {
            return 'vendor-calendar';
          }

          // ── Rich text editor ──────────────────────────────────────────
          if (id.includes('@tiptap') || id.includes('prosemirror')) {
            return 'vendor-editor';
          }

          // ── Drag-and-drop ─────────────────────────────────────────────
          if (id.includes('@dnd-kit')) {
            return 'vendor-dnd';
          }

          // ── Data table ────────────────────────────────────────────────
          if (id.includes('@tanstack/react-table')) {
            return 'vendor-table';
          }

          // ── UI utilities ──────────────────────────────────────────────
          if (id.includes('lucide-react') || id.includes('cmdk')) {
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
