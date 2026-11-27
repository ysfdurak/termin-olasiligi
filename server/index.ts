// Termin Olasılığı sunucusu: node server/index.ts
// Ayarlar ortam değişkeninden (.env.example). Node 22.18+ TypeScript dosyalarını derlemeden çalıştırır.
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { uygulama } from './uygulama.ts';

const ortam = process.env;
const port = Number(ortam.PORT || 8080);
const isle = uygulama({
  dist: resolve(ortam.DIST || 'dist'),
  mcpAcik: ortam.MCP_ACIK !== '0',
  izinliKaynaklar: (ortam.IZINLI_KAYNAKLAR || 'https://termin.ysfdurak.com').split(',').map((s) => s.trim()).filter(Boolean),
  mcpDakikada: Number(ortam.MCP_DAKIKADA || 60),
  sayfaDakikada: Number(ortam.SAYFA_DAKIKADA || 600),
  govdeSiniri: 512 * 1024,
  kayit: (m) => console.error(new Date().toISOString(), m),
});

const sunucu = createServer({ requestTimeout: 30000, headersTimeout: 15000 }, (req, res) => void isle(req, res));
sunucu.keepAliveTimeout = 5000;
sunucu.listen(port, () => console.log(`Termin Olasılığı http://127.0.0.1:${port} (MCP: ${ortam.MCP_ACIK !== '0' ? '/mcp' : 'kapalı'})`));
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => sunucu.close(() => process.exit(0)));
