// Senaryo: bir ya da birkaç işin tahmini değişirse sonuç ne olur?
// İki hesap AYNI tohumla yapılır (ortak rastgele sayılar): fark gürültüden değil, değişiklikten gelir.
import { bittiMi } from './ag.ts';
import { simuleEt, tohumBul } from './simulasyon.ts';
import type { Proje, SimSecenek, Sonuc } from './tipler.ts';

export interface Degisiklik {
  kod: string;
  iyimser: number;
  olasi: number;
  kotumser: number;
}

export interface SenaryoSonucu {
  once: Sonuc;
  sonra: Sonuc;
  fark: { p50: number; p85: number; p95: number; plan?: number };
  proje: Proje;
}

export function senaryoUygula(p: Proje, degisiklikler: Degisiklik[]): Proje {
  const m = new Map(degisiklikler.map((d) => [d.kod, d]));
  for (const d of degisiklikler) if (!p.isler.some((is) => is.kod === d.kod)) throw new Error(`"${d.kod}" kodlu iş projede yok.`);
  return {
    ...p,
    isler: p.isler.map((is) => {
      const d = m.get(is.kod);
      if (!d) return is;
      // Biten işin geçmişi değişmez; senaryo ancak bitmemiş işte anlamlıdır.
      if (bittiMi(is)) throw new Error(`"${is.kod}" işi bitmiş; gerçekleşen süresi senaryoyla değiştirilemez.`);
      return { ...is, iyimser: d.iyimser, olasi: d.olasi, kotumser: d.kotumser };
    }),
  };
}

export function senaryoDene(p: Proje, degisiklikler: Degisiklik[], secenek?: SimSecenek): SenaryoSonucu {
  const tohum = tohumBul(p, secenek);
  const s = { ...secenek, tohum };
  const yeni = senaryoUygula(p, degisiklikler);
  const once = simuleEt(p, s);
  const sonra = simuleEt(yeni, s);
  const fark: SenaryoSonucu['fark'] = { p50: sonra.p50 - once.p50, p85: sonra.p85 - once.p85, p95: sonra.p95 - once.p95 };
  if (once.plan && sonra.plan) fark.plan = sonra.plan.olasilik - once.plan.olasilik;
  return { once, sonra, fark, proje: yeni };
}
