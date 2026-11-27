// HTTP katmanı: derlenmiş web arayüzünü (dist/) sunar, /mcp kapısını ve /healthz'yi açar.
// Hesap tarayıcıda yapılır; sunucu web için yalnızca dosya sunar. Kullanıcı verisi sunucuda tutulmaz.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CSP_UYGULAMA, GovdeHatasi, baslikYaz, govdeOku, hizSiniri, istemciIp, kaynakIzinli } from './guvenlik.ts';
import { mcpIsleyici } from './mcp.ts';

const TUR: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

export interface Ayar {
  dist: string;
  mcpAcik: boolean;
  /** Tarayıcıdan /mcp isteğine izin verilen kaynaklar (Origin). Claude sunucudan çağırır, Origin göndermez. */
  izinliKaynaklar: string[];
  mcpDakikada: number;
  sayfaDakikada: number;
  govdeSiniri: number;
  kayit: (m: string) => void;
}

export function uygulama(ayar: Ayar) {
  const kok = resolve(ayar.dist);
  const indexYolu = join(kok, 'index.html');
  const grafikYolu = resolve(kok, '..', 'dist-mcp-app', 'egri.html');
  const grafikHtml = existsSync(grafikYolu) ? readFileSync(grafikYolu, 'utf8') : null;
  const mcp = mcpIsleyici({ grafikHtml, kayit: ayar.kayit });
  const mcpSinir = hizSiniri(ayar.mcpDakikada);
  const sayfaSinir = hizSiniri(ayar.sayfaDakikada);

  function json(res: ServerResponse, durum: number, govde: unknown) {
    baslikYaz(res, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.writeHead(durum);
    res.end(JSON.stringify(govde));
  }

  function dosyaGonder(res: ServerResponse, yol: string, basOnly: boolean) {
    const uz = extname(yol).toLowerCase();
    const html = uz === '.html';
    baslikYaz(res, {
      'Content-Type': TUR[uz] || 'application/octet-stream',
      'Cache-Control': html ? 'no-cache' : yol.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      ...(html ? { 'Content-Security-Policy': CSP_UYGULAMA } : {}),
    });
    res.writeHead(200);
    if (basOnly) return res.end();
    createReadStream(yol).pipe(res);
  }

  return async function isle(req: IncomingMessage, res: ServerResponse) {
    try {
      const url = new URL(req.url || '/', 'http://yerel');
      const yol = url.pathname;
      const ip = istemciIp(req);

      if (yol === '/healthz') return json(res, 200, { durum: 'ok' });

      if (yol === '/mcp') {
        if (!ayar.mcpAcik) return json(res, 404, { hata: 'MCP kapısı bu kurulumda kapalı.' });
        if (!kaynakIzinli(req.headers.origin, ayar.izinliKaynaklar)) return json(res, 403, { hata: 'Bu kaynaktan izin yok.' });
        if (req.method !== 'POST') {
          baslikYaz(res, { Allow: 'POST', 'Cache-Control': 'no-store' });
          res.writeHead(405);
          return res.end();
        }
        if (!mcpSinir(ip)) return json(res, 429, { hata: 'Çok fazla istek; bir dakika sonra deneyin.' });
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { hata: 'JSON bekleniyor.' });
        const metin = await govdeOku(req, ayar.govdeSiniri);
        let govde: unknown;
        try {
          govde = JSON.parse(metin);
        } catch {
          return json(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: 'Geçersiz JSON' }, id: null });
        }
        baslikYaz(res, { 'Cache-Control': 'no-store' });
        return await mcp.isle(req, res, govde);
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        baslikYaz(res, { Allow: 'GET, HEAD' });
        res.writeHead(405);
        return res.end();
      }
      if (!sayfaSinir(ip)) return json(res, 429, { hata: 'Çok fazla istek.' });

      // Dosya yolu: çözülüp kök klasörün içinde mi diye bakılır (dizin gezme yok)
      let hedef = resolve(kok, '.' + normalize(decodeURIComponent(yol)));
      if (hedef !== kok && !hedef.startsWith(kok + sep)) return json(res, 400, { hata: 'Geçersiz yol.' });
      if (hedef === kok || (existsSync(hedef) && statSync(hedef).isDirectory())) hedef = indexYolu;
      if (!existsSync(hedef) || !statSync(hedef).isFile()) {
        baslikYaz(res, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.writeHead(404);
        return res.end('Bulunamadı');
      }
      return dosyaGonder(res, hedef, req.method === 'HEAD');
    } catch (e) {
      if (e instanceof GovdeHatasi) return json(res, e.durum, { hata: e.message });
      if (e instanceof URIError) return json(res, 400, { hata: 'Geçersiz adres.' });
      ayar.kayit(`Sunucu hatası: ${(e as Error)?.stack || e}`);
      if (!res.headersSent) json(res, 500, { hata: 'Sunucu hatası.' });
      else res.end();
    }
  };
}
