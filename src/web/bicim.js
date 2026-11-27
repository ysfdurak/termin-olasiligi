// Sayı ve tarih biçimleri (dile göre).
import { bitisTarihi } from '../cekirdek/takvim.ts';

const yerel = (dil) => (dil === 'en' ? 'en-GB' : 'tr-TR');

export function sayi(x, dil, basamak = 1) {
  if (x === undefined || x === null || !Number.isFinite(x)) return '—';
  return x.toLocaleString(yerel(dil), { minimumFractionDigits: basamak, maximumFractionDigits: basamak });
}

export function tamSayi(x, dil) {
  return Number(x).toLocaleString(yerel(dil), { maximumFractionDigits: 0 });
}

export function yuzde(x, dil) {
  if (!Number.isFinite(x)) return '—';
  const v = Math.round(x * 100);
  // %18 (TR) / 18% (EN); 0 ile 1 arasındaki uç değerler "<%1" / ">%99" olarak yazılır
  const metin = x > 0 && v === 0 ? '<1' : x < 1 && v === 100 ? '>99' : String(v);
  return dil === 'en' ? `${metin}%` : `%${metin}`;
}

export function tarih(t, dil, uzun = false) {
  if (!t) return '—';
  const d = new Date(t + 'T00:00:00Z');
  return d.toLocaleDateString(yerel(dil), { day: 'numeric', month: uzun ? 'long' : 'short', year: 'numeric', weekday: uzun ? 'short' : undefined, timeZone: 'UTC' });
}

/** Simülasyondaki iş günü değerini proje takvimiyle tarihe çevirir. */
export function gunTarih(proje, gun, dil, uzun = false) {
  return tarih(bitisTarihi(proje.baslangic, gun), dil, uzun);
}
