// İş ağı: doğrulama, sıralama (topolojik), kritik yol.
import type { Bulgu, Is, Proje } from './tipler.ts';

export const SINIR = { is: 500, oncul: 30, sure: 5000, kodUzunluk: 20, adUzunluk: 120 } as const;
const KOD_BICIM = /^[\p{L}\p{N}._-]{1,20}$/u;
const TARIH = /^\d{4}-\d{2}-\d{2}$/;

/** Bitmiş ve gerçek süresi girilmiş iş sabit süreli sayılır. */
export function bittiMi(is: Is): boolean {
  return is.durum === 'bitti' && typeof is.gerceklesen === 'number' && Number.isFinite(is.gerceklesen);
}

/** Simülasyonda kullanılacak üç nokta: biten işte gerçekleşen süre, diğerlerinde tahmin. */
export function ucNokta(is: Is): [number, number, number] {
  if (bittiMi(is)) {
    const g = is.gerceklesen as number;
    return [g, g, g];
  }
  return [is.iyimser, is.olasi, is.kotumser];
}

export function tarihGecerli(t: string): boolean {
  if (!TARIH.test(t)) return false;
  const d = new Date(t + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}

/**
 * Projeyi denetler. Hata varsa simülasyon çalışmaz; uyarılar yalnızca gösterilir.
 * Kurallar kapsam dokümanındaki "Doğrulama kuralları" bölümünden.
 */
export function dogrula(p: Proje): Bulgu[] {
  const b: Bulgu[] = [];
  const isler = Array.isArray(p?.isler) ? p.isler : [];
  if (!isler.length) return [{ seviye: 'hata', kod: 'bos_proje' }];
  if (isler.length > SINIR.is) return [{ seviye: 'hata', kod: 'cok_is', deger: String(SINIR.is) }];
  if (!p.baslangic || !tarihGecerli(p.baslangic)) b.push({ seviye: 'hata', kod: 'tarih_bicim', deger: 'baslangic' });
  if (p.planTarihi) {
    if (!tarihGecerli(p.planTarihi)) b.push({ seviye: 'hata', kod: 'tarih_bicim', deger: 'planTarihi' });
    else if (p.baslangic && tarihGecerli(p.baslangic) && p.planTarihi < p.baslangic) b.push({ seviye: 'hata', kod: 'plan_once' });
  }
  if (p.durumTarihi && (!tarihGecerli(p.durumTarihi) || (tarihGecerli(p.baslangic) && p.durumTarihi < p.baslangic))) b.push({ seviye: 'hata', kod: 'tarih_bicim', deger: 'durumTarihi' });

  const kodlar = new Map<string, number>();
  for (const is of isler) {
    const kod = String(is?.kod ?? '').trim();
    if (!kod) {
      b.push({ seviye: 'hata', kod: 'kod_bos', isler: [String(is?.ad ?? '')] });
      continue;
    }
    if (!KOD_BICIM.test(kod)) b.push({ seviye: 'hata', kod: 'kod_bicim', isler: [kod.slice(0, 30)] });
    kodlar.set(kod, (kodlar.get(kod) || 0) + 1);
  }
  for (const [kod, adet] of kodlar) if (adet > 1) b.push({ seviye: 'hata', kod: 'kod_tekrar', isler: [kod] });

  for (const is of isler) {
    const kod = String(is?.kod ?? '');
    if (!String(is?.ad ?? '').trim()) b.push({ seviye: 'hata', kod: 'ad_bos', isler: [kod] });
    const ucu = [is.iyimser, is.olasi, is.kotumser];
    if (bittiMi(is)) {
      if ((is.gerceklesen as number) < 0) b.push({ seviye: 'hata', kod: 'negatif', isler: [kod] });
      else if ((is.gerceklesen as number) > SINIR.sure) b.push({ seviye: 'hata', kod: 'cok_buyuk', isler: [kod], deger: String(SINIR.sure) });
    } else if (ucu.some((x) => typeof x !== 'number' || !Number.isFinite(x))) {
      b.push({ seviye: 'hata', kod: 'sayi_degil', isler: [kod] });
    } else if (ucu.some((x) => x < 0)) {
      b.push({ seviye: 'hata', kod: 'negatif', isler: [kod] });
    } else if (ucu.some((x) => x > SINIR.sure)) {
      b.push({ seviye: 'hata', kod: 'cok_buyuk', isler: [kod], deger: String(SINIR.sure) });
    } else if (!(is.iyimser <= is.olasi && is.olasi <= is.kotumser)) {
      b.push({ seviye: 'hata', kod: 'sira', isler: [kod] });
    } else if (is.iyimser === is.kotumser) {
      b.push({ seviye: 'uyari', kod: 'tek_nokta', isler: [kod] });
    }
    const onc = Array.isArray(is.onculler) ? is.onculler : [];
    if (onc.length > SINIR.oncul) b.push({ seviye: 'hata', kod: 'cok_oncul', isler: [kod], deger: String(SINIR.oncul) });
    for (const o of onc) {
      if (o === kod) b.push({ seviye: 'hata', kod: 'kendine_oncul', isler: [kod] });
      else if (!kodlar.has(o)) b.push({ seviye: 'hata', kod: 'bilinmeyen_oncul', isler: [kod], deger: String(o).slice(0, 30) });
    }
  }
  if (b.some((x) => x.seviye === 'hata')) return b;

  const sira = siraBul(isler);
  if (!sira.tamam) {
    b.push({ seviye: 'hata', kod: 'dongu', isler: sira.dongu });
    return b;
  }

  // Kopuk iş: birden çok işli projede ne öncülü ne ardılı olan iş (büyük ihtimalle bağımlılık unutulmuş).
  if (isler.length > 1) {
    const ardilVar = new Set<string>();
    for (const is of isler) for (const o of is.onculler) ardilVar.add(o);
    const kopuk = isler.filter((is) => !is.onculler.length && !ardilVar.has(is.kod)).map((is) => is.kod);
    if (kopuk.length) b.push({ seviye: 'uyari', kod: 'kopuk', isler: kopuk });
  }

  // Aynı sorumluya paralel yürüyebilen iki iş verilmişse: V1 kaynak kısıtı modellemez, bunu söyler.
  const atalar = ataKumeleri(isler, sira.sira);
  const sorumluya = new Map<string, Is[]>();
  for (const is of isler) {
    const s = (is.sorumlu || '').trim();
    if (s && !bittiMi(is)) sorumluya.set(s, [...(sorumluya.get(s) || []), is]);
  }
  for (const [s, liste] of sorumluya) {
    for (let i = 0; i < liste.length; i++) {
      for (let j = i + 1; j < liste.length; j++) {
        const x = liste[i].kod;
        const y = liste[j].kod;
        if (!atalar.get(x)!.has(y) && !atalar.get(y)!.has(x)) {
          b.push({ seviye: 'uyari', kod: 'cakisan_sorumlu', isler: [x, y], deger: s });
        }
      }
    }
  }
  return b;
}

export function hataVar(b: Bulgu[]): boolean {
  return b.some((x) => x.seviye === 'hata');
}

/** Kahn algoritması. Döngü varsa döngüdeki (sıralanamayan) işleri döner. */
export function siraBul(isler: Is[]): { tamam: boolean; sira: number[]; dongu: string[] } {
  const indeks = new Map(isler.map((is, i) => [is.kod, i]));
  const giris = isler.map((is) => is.onculler.length);
  const ardil: number[][] = isler.map(() => []);
  isler.forEach((is, i) => is.onculler.forEach((o) => ardil[indeks.get(o)!].push(i)));
  const kuyruk: number[] = [];
  giris.forEach((g, i) => g === 0 && kuyruk.push(i));
  const sira: number[] = [];
  while (kuyruk.length) {
    const i = kuyruk.shift()!;
    sira.push(i);
    for (const j of ardil[i]) if (--giris[j] === 0) kuyruk.push(j);
  }
  const tamam = sira.length === isler.length;
  return { tamam, sira, dongu: tamam ? [] : isler.filter((_, i) => giris[i] > 0).map((is) => is.kod) };
}

function ataKumeleri(isler: Is[], sira: number[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const i of sira) {
    const is = isler[i];
    const s = new Set<string>();
    for (const o of is.onculler) {
      s.add(o);
      for (const a of m.get(o)!) s.add(a);
    }
    m.set(is.kod, s);
  }
  return m;
}

/** Derlenmiş ağ: simülasyon döngüsünde nesne yerine dizi kullanılır (hız). */
export interface Ag {
  n: number;
  kod: string[];
  ad: string[];
  sira: number[];
  oncul: number[][];
  ardil: number[][];
  a: Float64Array;
  m: Float64Array;
  b: Float64Array;
  sabit: Uint8Array;
  /** Veri tarihi sınırı: bitmemiş iş bu günden önce başlayamaz (bekliyor) ya da bitemez (devam). */
  basAlt: Float64Array;
  bitAlt: Float64Array;
}

export function agKur(isler: Is[], gecenGun = 0): Ag {
  const n = isler.length;
  const indeks = new Map(isler.map((is, i) => [is.kod, i]));
  const { sira, tamam } = siraBul(isler);
  if (!tamam) throw new Error('Bağımlılıklar döngü içeriyor.');
  const oncul = isler.map((is) => is.onculler.map((o) => indeks.get(o)!));
  const ardil: number[][] = isler.map(() => []);
  oncul.forEach((l, i) => l.forEach((o) => ardil[o].push(i)));
  const a = new Float64Array(n);
  const m = new Float64Array(n);
  const b = new Float64Array(n);
  const sabit = new Uint8Array(n);
  const basAlt = new Float64Array(n);
  const bitAlt = new Float64Array(n);
  isler.forEach((is, i) => {
    if (gecenGun > 0 && !bittiMi(is)) {
      if (is.durum === 'devam') bitAlt[i] = gecenGun;
      else basAlt[i] = gecenGun;
    }
    const [x, y, z] = ucNokta(is);
    a[i] = x;
    m[i] = y;
    b[i] = z;
    sabit[i] = z - x <= 0 ? 1 : 0;
  });
  return { n, kod: isler.map((x) => x.kod), ad: isler.map((x) => x.ad), sira, oncul, ardil, a, m, b, sabit, basAlt, bitAlt };
}

/**
 * Verilen sürelerle ileri ve geri geçiş. es/ef: en erken başlangıç/bitiş.
 * Kritik işler (bolluk ≈ 0) `kritik` dizisinde 1 olur. Proje süresini döner.
 */
export function gecis(ag: Ag, sure: Float64Array, es: Float64Array, ef: Float64Array, lf: Float64Array, kritik: Uint8Array): number {
  let toplam = 0;
  for (const i of ag.sira) {
    let bas = ag.basAlt[i];
    for (const o of ag.oncul[i]) if (ef[o] > bas) bas = ef[o];
    es[i] = bas;
    ef[i] = Math.max(bas + sure[i], ag.bitAlt[i]);
    if (ef[i] > toplam) toplam = ef[i];
  }
  for (let k = ag.sira.length - 1; k >= 0; k--) {
    const i = ag.sira[k];
    let son = toplam;
    for (const s of ag.ardil[i]) {
      const ls = lf[s] - (ef[s] - es[s]);
      if (ls < son) son = ls;
    }
    lf[i] = son;
    kritik[i] = son - ef[i] <= 1e-9 * (1 + toplam) ? 1 : 0;
  }
  return toplam;
}

/** Kritik işlerden başlangıçtan sona tek bir yol seçer (gösterim için). */
export function kritikYol(ag: Ag, ef: Float64Array, kritik: Uint8Array, es: Float64Array): number[] {
  let son = -1;
  for (let i = 0; i < ag.n; i++) if (kritik[i] && !ag.ardil[i].some((s) => kritik[s]) && (son < 0 || ef[i] > ef[son])) son = i;
  const yol: number[] = [];
  let i = son;
  while (i >= 0) {
    yol.push(i);
    const bas = es[i];
    let sonraki = -1;
    for (const o of ag.oncul[i]) if (kritik[o] && Math.abs(ef[o] - bas) <= 1e-9 * (1 + ef[i])) sonraki = o;
    i = sonraki;
  }
  return yol.reverse();
}
