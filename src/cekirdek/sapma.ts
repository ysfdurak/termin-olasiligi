// Biten işlerde tahmin sapması: gerçekleşen süre en olası tahminin kaç katı?
// V1 yalnızca GÖSTERİR, yeni tahminleri düzeltmez. Düzeltme (kalibrasyon) V2'nin işi ve
// kategori başına en az veri eşiği ister (kapsam dokümanı: "Riskler ve sınırlar").
import type { Proje } from './tipler.ts';

export const KALIBRASYON_ESIGI = 10;

export interface SapmaSatiri {
  kategori: string;
  adet: number;
  /** Gerçekleşen / olası oranlarının geometrik ortalaması. 1,30 = %30 uzun sürdü. */
  oran: number;
  /** Kalibrasyon için yeterli veri var mı (V2). */
  yeterli: boolean;
}

export function tahminSapmasi(p: Proje): { toplam: SapmaSatiri | null; kategoriler: SapmaSatiri[] } {
  const gruplar = new Map<string, number[]>();
  const hepsi: number[] = [];
  for (const is of p.isler) {
    if (is.durum !== 'bitti' || typeof is.gerceklesen !== 'number' || !(is.olasi > 0) || !(is.gerceklesen > 0)) continue;
    const r = Math.log(is.gerceklesen / is.olasi);
    hepsi.push(r);
    const k = (is.kategori || '').trim() || '—';
    gruplar.set(k, [...(gruplar.get(k) || []), r]);
  }
  const satir = (kategori: string, l: number[]): SapmaSatiri => ({
    kategori,
    adet: l.length,
    oran: Math.exp(l.reduce((a, b) => a + b, 0) / l.length),
    yeterli: l.length >= KALIBRASYON_ESIGI,
  });
  return {
    toplam: hepsi.length ? satir('', hepsi) : null,
    kategoriler: [...gruplar].map(([k, l]) => satir(k, l)).sort((a, b) => b.adet - a.adet),
  };
}
