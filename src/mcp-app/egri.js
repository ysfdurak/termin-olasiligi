// "Bitiş olasılığı" MCP App'i: Claude'un içinde açılan olasılık eğrisi.
// Akış: Claude bitis_olasiligi aracını çağırır → host bu sayfayı iframe'de açar → sonuç (structuredContent)
// ontoolresult ile gelir → eğri çizilir. Sayfa sunucuya doğrudan istek atmaz.
// Güvenlik: proje ve iş adları kullanıcı girdisidir; DOM'a yalnızca textContent ile yazılır (innerHTML yok).
import { App, PostMessageTransport, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'Termin Olasılığı · Eğri', version: '1.0.0' }, {});
const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const G = 640;
const Y = 230;
const K = { sol: 40, sag: 12, ust: 22, alt: 30 };

function el(tag, ozellik = {}, cocuklar = []) {
  const n = tag === 'svg' || ['line', 'path', 'rect', 'text', 'g', 'circle'].includes(tag) ? document.createElementNS(NS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(ozellik)) {
    if (k === 'text') n.textContent = v;
    else n.setAttribute(k, String(v));
  }
  for (const c of cocuklar) n.append(c);
  return n;
}

const yuzde = (x, dil) => {
  const v = Math.round(x * 100);
  const m = x > 0 && v === 0 ? '<1' : x < 1 && v === 100 ? '>99' : String(v);
  return dil === 'en' ? `${m}%` : `%${m}`;
};
const sayi = (x, dil) => Number(x).toLocaleString(dil === 'en' ? 'en-GB' : 'tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const tarih = (t, dil) => new Date(t + 'T00:00:00Z').toLocaleDateString(dil === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function ciz(d) {
  const dil = d.dil || 'tr';
  const en = dil === 'en';
  document.documentElement.lang = dil;
  $('ad').textContent = d.proje.ad;
  $('plan').textContent = d.planTutmaOlasiligi !== null && d.proje.planTarihi ? `${en ? 'Committed' : 'Plan'} ${tarih(d.proje.planTarihi, dil)} · ${yuzde(d.planTutmaOlasiligi, dil)}` : '';
  $('kartlar').replaceChildren(
    ...['p50', 'p85', 'p95'].map((k) =>
      el('div', { class: 'kart ' + k }, [el('span', { text: en ? `${k.slice(1)}% chance` : `%${k.slice(1)} ihtimalle` }), el('b', { text: tarih(d[k].tarih, dil) }), el('div', { class: 'soluk kucuk', text: `${sayi(d[k].gun, dil)} ${en ? 'working days' : 'iş günü'}` })]),
    ),
  );
  const planGun = typeof d.planGun === 'number' ? d.planGun : null;
  const xs = d.egri.map((e) => e[0]).concat(planGun === null ? [] : [planGun]);
  let lo = Math.min(...xs);
  let hi = Math.max(...xs);
  const pay = Math.max(0.5, (hi - lo) * 0.05);
  lo -= pay;
  hi += pay;
  const gx = (v) => K.sol + ((v - lo) / (hi - lo)) * (G - K.sol - K.sag);
  const gy = (p) => Y - K.alt - p * (Y - K.ust - K.alt);
  const svg = $('grafik');
  const parca = [];
  for (const p of [0, 0.5, 1]) parca.push(el('line', { x1: K.sol, x2: G - K.sag, y1: gy(p), y2: gy(p), class: 'izgara' }), el('text', { x: K.sol - 5, y: gy(p) + 3, 'text-anchor': 'end', class: 'eksen', text: yuzde(p, dil) }));
  const enCok = Math.max(...d.histogram.map((h) => h[2] / (h[1] - h[0])));
  for (const h of d.histogram) {
    const yy = Y - K.alt - (h[2] / (h[1] - h[0]) / enCok) * (Y - K.ust - K.alt) * 0.6;
    parca.push(el('rect', { x: gx(h[0]) + 0.5, width: Math.max(0.5, gx(h[1]) - gx(h[0]) - 1), y: yy, height: Y - K.alt - yy, class: 'cubuk' }));
  }
  const adim = Math.max(1, Math.round((hi - lo) / 8));
  for (let v = Math.ceil(lo); v <= hi; v += adim) parca.push(el('text', { x: gx(v), y: Y - K.alt + 14, 'text-anchor': 'middle', class: 'eksen', text: String(v) }));
  parca.push(el('path', { d: d.egri.map(([x, p], i) => `${i ? 'L' : 'M'}${gx(x).toFixed(1)},${gy(p).toFixed(1)}`).join(''), class: 'cizgi' }));
  for (const [k, p] of [['p50', 0.5], ['p85', 0.85], ['p95', 0.95]]) {
    parca.push(el('line', { x1: gx(d[k].gun), x2: gx(d[k].gun), y1: gy(0), y2: gy(p), class: 'isaret ' + k }));
    parca.push(el('text', { x: gx(d[k].gun) - 4, y: gy(p) - 5, 'text-anchor': 'end', class: 'etiket ' + k, text: en ? `${k.slice(1)}%` : `%${k.slice(1)}` }));
  }
  if (planGun !== null) {
    parca.push(el('line', { x1: gx(planGun), x2: gx(planGun), y1: K.ust - 6, y2: gy(0), class: 'isaret plan' }));
    parca.push(el('text', { x: gx(planGun), y: K.ust - 9, 'text-anchor': 'middle', class: 'etiket plan', text: `${en ? 'Plan' : 'Plan'} · ${yuzde(d.planTutmaOlasiligi, dil)}` }));
  }
  const imlec = el('line', { x1: 0, x2: 0, y1: K.ust, y2: gy(0), class: 'imlec', visibility: 'hidden' });
  parca.push(imlec);
  svg.replaceChildren(...parca);
  svg.onpointermove = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * G;
    const gun = lo + ((px - K.sol) / (G - K.sol - K.sag)) * (hi - lo);
    let p = 0;
    for (const [x, q] of d.egri) if (x <= gun) p = q;
    imlec.setAttribute('x1', String(px));
    imlec.setAttribute('x2', String(px));
    imlec.setAttribute('visibility', 'visible');
    $('bilgi').textContent = `${sayi(gun, dil)} ${en ? 'working days' : 'iş günü'} → ${yuzde(p, dil)}`;
  };
  svg.onpointerleave = () => {
    imlec.setAttribute('visibility', 'hidden');
    $('bilgi').textContent = en ? 'Line: chance of finishing by that day. Bars: distribution of runs.' : 'Çizgi: o güne kadar bitme olasılığı. Çubuklar: turların dağılımı.';
  };
  svg.onpointerleave();
  const ol = el('ol', {}, (d.riskli || []).map((r) => el('li', { text: `${r.kod} · ${r.ad} (${en ? 'sensitivity' : 'duyarlılık'} ${sayi(r.duyarlilik, dil)})` })));
  $('riskli').replaceChildren(el('b', { text: en ? 'Moves the deadline most' : 'Termini en çok oynatan' }), ol);
  $('durum').textContent = `${d.tur.toLocaleString()} ${en ? 'runs' : 'tur'}`;
  $('durum').className = 'kucuk soluk';
}

function hata(m) {
  $('durum').textContent = m;
  $('durum').className = 'kucuk hata';
}

function host(ctx) {
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
  if (ctx?.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
}

// Dinleyiciler bağlanmadan önce kurulmalı; aksi halde ilk sonuç kaçabilir.
app.ontoolresult = (r) => {
  if (r.isError) return hata(r.content?.[0]?.text || 'Hesap yapılamadı.');
  if (r.structuredContent) ciz(r.structuredContent);
};
app.onhostcontextchanged = host;
app
  .connect(new PostMessageTransport(window.parent, window.parent))
  .then(() => host(app.getHostContext()))
  .catch((e) => hata('Claude ile bağlantı kurulamadı: ' + (e?.message || e)));
