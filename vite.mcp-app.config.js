import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// MCP App görünümü (src/mcp-app/): tek HTML dosyası. Sunucu bunu ui://termin/egri.html kaynağı olarak verir,
// Claude yalıtılmış bir iframe'de açar. Sayfa ağ isteği atmaz; veri aracın sonucundan (postMessage) gelir.
export default defineConfig({
  root: 'src/mcp-app',
  plugins: [viteSingleFile()],
  build: { outDir: '../../dist-mcp-app', emptyOutDir: true, rollupOptions: { input: 'src/mcp-app/egri.html' } },
});
