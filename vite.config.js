import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          motion: ['gsap', 'gsap/ScrollTrigger', 'lenis'],
        },
      },
    },
  },
});
