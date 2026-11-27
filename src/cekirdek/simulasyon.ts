// Monte Carlo simülasyonu: her turda her işe PERT dağılımından süre çekilir, ağ hesaplanır.
// Binlerce turun proje süreleri olasılık eğrisini verir.
import { agKur, dogrula, gecis, hataVar, kritikYol } from './ag.ts';
import { metindenTohum, normalUretec, pertCek, pertOrtalama, pertSapma, uretec } from './rastgele.ts';
import { gecenIsGunu, isGunuSay } from './takvim.ts';
import type { Proje, SimSecenek, Sonuc, TekTur } from './tipler.ts';

export const VARSAYILAN_TUR = 10000;
export const EN_COK_TUR = 200000;

/** Normal dağılımın %85 değeri (z). Klasik PERT karşılaştırması için. */
const Z85 = 1.0364333894937898;

/** Sıralı dizide doğrusal aradeğerli yüzdelik (Excel YÜZDEBİRLİK.DAHİL ve numpy varsayılanı ile aynı). */
export function yuzdelik(sirali: Float64Array, p: number): number {
  if (!sirali.length) return NaN;
  const h = (sirali.length - 1) * p;
  const alt = Math.floor(h);
  const ust = Math.min(alt + 1, sirali.length - 1);
  return sirali[alt] + (h - alt) * (sirali[ust] - sirali[alt]);
}

/** Süre ≤ gün olan turların oranı (ikili arama). */
export function olasilik(sirali: Float64Array, gun: number): number {
  let lo = 0;
  let hi = sirali.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sirali[mid] <= gun + 1e-9) lo = mid + 1;
    else hi = mid;
  }
  return sirali.length ? lo / sirali.length : 0;
}

export function tohumBul(p: Proje, s?: SimSecenek): number {
  return s?.tohum !== undefined ? s.tohum >>> 0 : metindenTohum(p.id || p.ad || 'proje');
}

/**
 * Projeyi simüle eder. Hatalı projede Error fırlatır (önce `dogrula` çağrılması beklenir).
 * Aynı proje + aynı tohum = aynı sonuç (web, Worker ve MCP aynı sayıyı gösterir).
 */
export function simuleEt(p: Proje, secenek?: SimSecenek): Sonuc {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const bulgular = dogrula(p);
  if (hataVar(bulgular)) throw new Error('Proje hatalı; önce doğrulama hatalarını düzeltin.');
  const tur = Math.max(100, Math.min(EN_COK_TUR, Math.round(secenek?.tur ?? VARSAYILAN_TUR)));
  const tohum = tohumBul(p, secenek);
  const gecen = gecenGunBul(p);
  const ag = agKur(p.isler, gecen);
  const n = ag.n;
  const r = uretec(tohum);
  const z = normalUretec(r);

  const sure = new Float64Array(n);
  const es = new Float64Array(n);
  const ef = new Float64Array(n);
  const lf = new Float64Array(n);
  const kritik = new Uint8Array(n);
  const toplamlar = new Float64Array(tur);
  const kritikSay = new Float64Array(n);
  // Korelasyon için tek geçişte toplamlar (Pearson): Σx, Σx², Σxy; Σy ve Σy² ortak.
  const sx = new Float64Array(n);
  const sxx = new Float64Array(n);
  const sxy = new Float64Array(n);
  let sy = 0;
  let syy = 0;
  let ornekTur: TekTur | null = null;

  for (let k = 0; k < tur; k++) {
    for (let i = 0; i < n; i++) sure[i] = ag.sabit[i] ? ag.a[i] : pertCek(ag.a[i], ag.m[i], ag.b[i], r, z);
    const t = gecis(ag, sure, es, ef, lf, kritik);
    toplamlar[k] = t;
    sy += t;
    syy += t * t;
    for (let i = 0; i < n; i++) {
      kritikSay[i] += kritik[i];
      sx[i] += sure[i];
      sxx[i] += sure[i] * sure[i];
      sxy[i] += sure[i] * t;
    }
    if (k === 0) {
      const yol = kritikYol(ag, ef, kritik, es);
      const o: TekTur = { sureler: {}, baslangic: {}, bitis: {}, kritikYol: yol.map((i) => ag.kod[i]), toplam: t };
      for (let i = 0; i < n; i++) {
        o.sureler[ag.kod[i]] = ef[i] - es[i];
        o.baslangic[ag.kod[i]] = es[i];
        o.bitis[ag.kod[i]] = ef[i];
      }
      ornekTur = o;
    }
  }

  const sirali = toplamlar.slice().sort();
  const ortalama = sy / tur;
  const varY = syy / tur - ortalama * ortalama;
  const isler = p.isler.map((is, i) => {
    const mx = sx[i] / tur;
    const varX = sxx[i] / tur - mx * mx;
    const kov = sxy[i] / tur - mx * ortalama;
    const duyarlilik = ag.sabit[i] || varX <= 1e-12 || varY <= 1e-12 ? 0 : kov / Math.sqrt(varX * varY);
    return { kod: is.kod, ad: is.ad, kritiklik: kritikSay[i] / tur, duyarlilik, ortalama: mx, sabit: !!ag.sabit[i] };
  });

  const det = deterministikPlan(p);
  const sonuc: Sonuc = {
    tur,
    tohum,
    ortalama,
    stdSapma: Math.sqrt(Math.max(0, varY)),
    enKisa: sirali[0],
    enUzun: sirali[tur - 1],
    p50: yuzdelik(sirali, 0.5),
    p85: yuzdelik(sirali, 0.85),
    p95: yuzdelik(sirali, 0.95),
    deterministik: det.toplam,
    deterministikYol: det.yol,
    pert: klasikPert(p),
    isler,
    egri: egriCikar(sirali),
    histogram: histogramCikar(sirali),
    ornekTur: ornekTur as TekTur,
    sureMs: 0,
  };
  if (p.planTarihi) {
    const gun = isGunuSay(p.baslangic, p.planTarihi);
    sonuc.plan = { gun, olasilik: olasilik(sirali, gun) };
  }
  if (gecen > 0) sonuc.gecenGun = gecen;
  if (secenek?.hedefGun !== undefined) sonuc.hedef = { gun: secenek.hedefGun, olasilik: olasilik(sirali, secenek.hedefGun) };
  sonuc.sureMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  return sonuc;
}

/** Sabit sürelerle ağ hesabı. `sec` her işin üç noktasından birini seçer. */
export function gecenGunBul(p: Proje): number {
  return p.durumTarihi ? gecenIsGunu(p.baslangic, p.durumTarihi) : 0;
}

function sabitHesap(p: Proje, sec: (a: number, m: number, b: number) => number) {
  const ag = agKur(p.isler, gecenGunBul(p));
  const sure = new Float64Array(ag.n);
  for (let i = 0; i < ag.n; i++) sure[i] = sec(ag.a[i], ag.m[i], ag.b[i]);
  const es = new Float64Array(ag.n);
  const ef = new Float64Array(ag.n);
  const lf = new Float64Array(ag.n);
  const kr = new Uint8Array(ag.n);
  const toplam = gecis(ag, sure, es, ef, lf, kr);
  const yol = kritikYol(ag, ef, kr, es);
  return { ag, toplam, yol: yol.map((i) => ag.kod[i]), yolIndeks: yol };
}

/** En olası değerlerle yapılan klasik plan: "planda X gün yazıyor". */
export function deterministikPlan(p: Proje): { toplam: number; yol: string[] } {
  const h = sabitHesap(p, (_a, m) => m);
  return { toplam: h.toplam, yol: h.yol };
}

/**
 * Klasik PERT: ortalamalarla bulunan tek kritik yolun ortalamaları toplanır,
 * varyansları toplanır, normal dağılım varsayılır. Paralel kolları yok sayar (birleşme yanlılığı).
 */
export function klasikPert(p: Proje): { ortalama: number; stdSapma: number; p85: number; yol: string[] } {
  const h = sabitHesap(p, (a, m, b) => pertOrtalama(a, m, b));
  let v = 0;
  for (const i of h.yolIndeks) v += pertSapma(h.ag.a[i], h.ag.b[i]) ** 2;
  const s = Math.sqrt(v);
  return { ortalama: h.toplam, stdSapma: s, p85: h.toplam + Z85 * s, yol: h.yol };
}

/** Birikimli eğri: yüzde 0–100 arası 101 nokta (grafik için yeterince düzgün, aktarması küçük). */
function egriCikar(sirali: Float64Array): [number, number][] {
  const e: [number, number][] = [];
  for (let k = 0; k <= 100; k++) e.push([yuzdelik(sirali, k / 100), k / 100]);
  return e;
}

/** Yaklaşık 30 kutulu histogram; kutu genişliği 0,25 / 0,5 / 1 / 2 / 5 … gibi okunur bir sayıya yuvarlanır. */
function histogramCikar(sirali: Float64Array): [number, number, number][] {
  const lo = sirali[0];
  const hi = sirali[sirali.length - 1];
  if (hi - lo < 1e-9) return [[lo, lo + 1, sirali.length]];
  const ham = (hi - lo) / 30;
  const us = 10 ** Math.floor(Math.log10(ham));
  const genislik = [1, 2, 2.5, 5, 10].map((x) => x * us).find((x) => x >= ham) || ham;
  const bas = Math.floor(lo / genislik) * genislik;
  const kutu = Math.max(1, Math.ceil((hi - bas) / genislik + 1e-9));
  const say = new Array(kutu).fill(0);
  for (const x of sirali) say[Math.min(kutu - 1, Math.floor((x - bas) / genislik))]++;
  return say.map((c, i) => [bas + i * genislik, bas + (i + 1) * genislik, c]);
}
