import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Web arayüzü: npm run build → dist/. Sunucu (server/index.ts) dist/ klasörünü sunar.
// Çekirdek (src/cekirdek/*.ts) hem burada paketlenir hem de sunucuda derlenmeden çalışır.
export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, target: 'es2022' },
  server: { port: 5173 },
});
