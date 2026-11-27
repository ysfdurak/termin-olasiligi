// Güvenlik yardımcıları: başlıklar, CSP, istemci IP'si (yalnız güvenilen vekilden), hız sınırı, gövde sınırı.
// Kaynak: ysfdurak.com → docs/GUVENLIK_TEMELI.md (2. ve 3. bölüm).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isIP } from 'node:net';

/** Ortak ölçüm yalnız resmî demo adresinde yüklenir; CSP'de yalnız script-src ve connect-src'ye eklenir. */
const OLCUM = 'https://olcum.ysfdurak.com';

export const CSP_UYGULAMA = [
  "default-src 'self'",
  `script-src 'self' ${OLCUM}`,
  `connect-src 'self' ${OLCUM}`,
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const CSP_HICBIRI = "default-src 'none'; frame-ancestors 'none'";

export function baslikYaz(res: ServerResponse, ek: Record<string, string> = {}): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', CSP_HICBIRI);
  for (const [k, v] of Object.entries(ek)) res.setHeader(k, v);
}

function ozelAg(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/, '');
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return ip === '::1' || /^f[cd]/i.test(ip);
}

/**
 * İstemci IP'si. Caddy `X-Forwarded-For`'u gerçek istemci IP'siyle kendisi yazar (Cloudflare'den gelen istekte
 * Cloudflare aralıkları güvenilir vekildir). Bu başlık yalnız istek özel ağdan (Docker ağındaki Caddy) geliyorsa okunur;
 * doğrudan gelen istekte sahte başlık sınırları atlatamaz.
 */
export function istemciIp(req: IncomingMessage): string {
  const uzak = req.socket.remoteAddress || '';
  if (ozelAg(uzak)) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (isIP(xff)) return xff;
  }
  return uzak;
}

/** Kayan pencere yerine dakikalık kova: IP başına sayaç, bellekte; dakikada bir temizlenir. */
export function hizSiniri(dakikadaEnCok: number) {
  let kova = new Map<string, number>();
  let dakika = Math.floor(Date.now() / 60000);
  return (anahtar: string): boolean => {
    const simdi = Math.floor(Date.now() / 60000);
    if (simdi !== dakika) {
      kova = new Map();
      dakika = simdi;
    }
    const n = (kova.get(anahtar) || 0) + 1;
    kova.set(anahtar, n);
    return n <= dakikadaEnCok;
  };
}

export class GovdeHatasi extends Error {
  durum: number;
  constructor(durum: number, ileti: string) {
    super(ileti);
    this.durum = durum;
  }
}

/** İstek gövdesini sınırla okur: sınır aşılınca 413 (bağlantı okunmaya devam etmez). */
export function govdeOku(req: IncomingMessage, sinir: number): Promise<string> {
  return new Promise((coz, reddet) => {
    const beyan = Number(req.headers['content-length'] || 0);
    if (beyan > sinir) return reddet(new GovdeHatasi(413, 'İstek çok büyük.'));
    let boyut = 0;
    const parcalar: Buffer[] = [];
    req.on('data', (p: Buffer) => {
      boyut += p.length;
      if (boyut > sinir) {
        reddet(new GovdeHatasi(413, 'İstek çok büyük.'));
        req.destroy();
        return;
      }
      parcalar.push(p);
    });
    req.on('end', () => coz(Buffer.concat(parcalar).toString('utf8')));
    req.on('error', reddet);
  });
}

/** İzin verilen kaynaklar (Origin). Tarayıcıdan gelen MCP isteği yalnız bu adreslerden kabul edilir (DNS rebinding). */
export function kaynakIzinli(origin: string | undefined, izinli: string[]): boolean {
  if (!origin) return true; // sunucudan sunucuya (Claude) istekte Origin yok
  return izinli.includes(origin);
}
