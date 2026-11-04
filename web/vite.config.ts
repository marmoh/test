import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [viteSingleFile()],
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' },
});
