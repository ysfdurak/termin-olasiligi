// Sunucu ve MCP testleri: başlıklar, CSP, dizin gezme, sınırlar, MCP araçları.
// Önce `npm run build` gerekir (dist/ ve dist-mcp-app/).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { uygulama } from '../server/uygulama.ts';

let taban = '';
const kayitlar: string[] = [];
const isle = uygulama({ dist: 'dist', mcpAcik: true, izinliKaynaklar: ['https://termin.ysfdurak.com'], mcpDakikada: 60, sayfaDakikada: 1000, govdeSiniri: 512 * 1024, kayit: (m) => kayitlar.push(m) });
const sunucu = createServer((req, res) => void isle(req, res));

before(async () => {
  await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', () => r()));
  taban = `http://127.0.0.1:${(sunucu.address() as AddressInfo).port}`;
});
after(() => sunucu.close());

async function istemci() {
  const c = new Client({ name: 'test', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(taban + '/mcp')));
  return c;
}
const json = (r: any) => JSON.parse(r.content[0].text);

test('Ana sayfa: CSP ve güvenlik başlıkları', async () => {
  const r = await fetch(taban + '/');
  assert.equal(r.status, 200);
  const csp = r.headers.get('content-security-policy') || '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /script-src 'self' https:\/\/olcum\.ysfdurak\.com/);
  for (const b of ['x-content-type-options', 'strict-transport-security', 'referrer-policy', 'permissions-policy', 'x-frame-options', 'cross-origin-opener-policy']) assert.ok(r.headers.get(b), b);
  assert.equal(r.headers.get('cache-control'), 'no-cache');
  const html = await r.text();
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'satır içi betik olmamalı');
});

test('Dizin gezme ve bilinmeyen yol', async () => {
  for (const y of ['/../package.json', '/%2e%2e/package.json', '/..%2fserver%2findex.ts', '/assets/../../package.json']) {
    const r = await fetch(taban + y);
    assert.ok([400, 404].includes(r.status), `${y} → ${r.status}`);
    assert.doesNotMatch(await r.text(), /"name": "termin/);
  }
  assert.equal((await fetch(taban + '/yok.js')).status, 404);
  assert.equal((await fetch(taban + '/%E0%A4%A')).status, 400);
  assert.equal((await fetch(taban + '/', { method: 'POST' })).status, 405);
});

test('Sağlık ve robots', async () => {
  assert.deepEqual(await (await fetch(taban + '/healthz')).json(), { durum: 'ok' });
  assert.match(await (await fetch(taban + '/robots.txt')).text(), /Disallow: \/mcp/);
});

test('MCP: kaynak denetimi, yöntem, tür, gövde sınırı', async () => {
  const baslik = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  const govde = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal((await fetch(taban + '/mcp', { method: 'POST', headers: { ...baslik, origin: 'https://kotu.example' }, body: govde })).status, 403);
  assert.equal((await fetch(taban + '/mcp')).status, 405);
  assert.equal((await fetch(taban + '/mcp', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: govde })).status, 415);
  assert.equal((await fetch(taban + '/mcp', { method: 'POST', headers: baslik, body: 'x'.repeat(600 * 1024) })).status, 413);
  assert.equal((await fetch(taban + '/mcp', { method: 'POST', headers: baslik, body: '{bozuk' })).status, 400);
  const r = await fetch(taban + '/mcp', { method: 'POST', headers: { ...baslik, origin: 'https://termin.ysfdurak.com' }, body: govde });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('MCP araçları: liste, örnek, bitiş olasılığı (kapsam sayıları), MCP App kaynağı', async () => {
  const c = await istemci();
  const araclar = (await c.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(araclar, ['bitis_olasiligi', 'en_riskli_isler', 'is_tahmini_guncelle', 'ornek_projeler', 'proje_yukle', 'senaryo_dene']);
  for (const t of (await c.listTools()).tools) assert.equal(t.annotations?.readOnlyHint, true, t.name);
  const ornekler = json(await c.callTool({ name: 'ornek_projeler', arguments: {} }));
  assert.equal(ornekler.length, 3);
  const r: any = await c.callTool({ name: 'bitis_olasiligi', arguments: { ornek: 'ornek-yontem', tur: 20000 } });
  const s = r.structuredContent;
  assert.ok(Math.abs(s.p85.gun - 26.0) <= 0.25, String(s.p85.gun));
  assert.ok(Math.abs(s.planTutmaOlasiligi - 0.18) <= 0.02);
  assert.equal(s.planGun, 22);
  assert.equal(s.egri.length, 101);
  assert.equal(s.riskli[0].kod, 'D');
  const k = await c.readResource({ uri: 'ui://termin/egri.html' });
  assert.match((k.contents[0] as any).text, /<html/);
  await c.close();
});

test('MCP: proje_yukle (CSV) → senaryo → güncelle; hatalar kullanıcıya açık ileti', async () => {
  const c = await istemci();
  const csv = 'is_kodu;is_adi;iyimser_gun;olasi_gun;kotumser_gun;onculler\nA;Analiz;2;3;6;\nB;Tasarım;3;5;10;A\nC;Veri;4;6;8;A\nD;Geliştirme;8;10;16;B,C\nE;Test;2;3;7;D';
  const y = json(await c.callTool({ name: 'proje_yukle', arguments: { ad: 'CSV projesi', baslangic: '2027-01-04', planTarihi: '2027-02-02', csv } }));
  assert.equal(y.gecerli, true);
  assert.equal(y.proje.isler.length, 5);
  const h: any = await c.callTool({ name: 'bitis_olasiligi', arguments: { proje: y.proje, tarih: '2027-02-12' } });
  assert.equal(h.structuredContent.hedef.gun, 30);
  assert.ok(h.structuredContent.hedef.olasilik > 0.99);
  const sen = json(await c.callTool({ name: 'senaryo_dene', arguments: { proje: y.proje, degisiklikler: [{ kod: 'D', iyimser: 6, olasi: 8, kotumser: 12 }] } }));
  assert.ok(sen.farkIsGunu.p85 < -2);
  const g = json(await c.callTool({ name: 'is_tahmini_guncelle', arguments: { proje: y.proje, kod: 'A', gerceklesen: 5 } }));
  assert.equal(g.proje.isler[0].durum, 'bitti');
  assert.ok(g.sonuc.p85.gun > g.onceP85.gun);
  const riskli = json(await c.callTool({ name: 'en_riskli_isler', arguments: { proje: g.proje, adet: 2 } }));
  assert.equal(riskli.isler.length, 2);

  const dongu = { ...y.proje, isler: y.proje.isler.map((is: any) => (is.kod === 'A' ? { ...is, onculler: ['E'] } : is)) };
  const e1: any = await c.callTool({ name: 'bitis_olasiligi', arguments: { proje: dongu } });
  assert.equal(e1.isError, true);
  assert.match(e1.content[0].text, /döngü/);
  const e2: any = await c.callTool({ name: 'bitis_olasiligi', arguments: {} });
  assert.equal(e2.isError, true);
  const e3: any = await c.callTool({ name: 'senaryo_dene', arguments: { ornek: 'ornek-panel', degisiklikler: [{ kod: 'A', iyimser: 1, olasi: 2, kotumser: 3 }] } });
  assert.match(e3.content[0].text, /bitmiş/);
  const e4: any = await c.callTool({ name: 'bitis_olasiligi', arguments: { ornek: 'ornek-yontem', tur: 10_000_000 } });
  assert.equal(e4.isError, true);
  await c.close();
  assert.equal(kayitlar.filter((k) => k.includes('MCP hatası')).length, 0, kayitlar.join('\n'));
});

test('MCP hız sınırı (429)', async () => {
  const baslik = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  const govde = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  let son = 0;
  for (let i = 0; i < 65; i++) son = (await fetch(taban + '/mcp', { method: 'POST', headers: baslik, body: govde })).status;
  assert.equal(son, 429);
});
