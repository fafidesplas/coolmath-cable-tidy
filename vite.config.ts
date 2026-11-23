import { defineConfig } from 'vite';

export default defineConfig({
  base: '/coolmath-cable-tidy/',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
