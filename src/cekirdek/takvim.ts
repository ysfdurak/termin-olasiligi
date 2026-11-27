// İş günü takvimi: hafta sonu (cumartesi, pazar) sayılmaz. Tatiller V1'de yok (kapsam kararı).
// Tarihler YYYY-MM-DD metnidir ve UTC gece yarısı olarak işlenir; saat dilimi kayması olmaz.

const GUN = 86400000;

function tarih(t: string): Date {
  return new Date(t + 'T00:00:00Z');
}
function metin(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function isGunuMu(d: Date): boolean {
  const g = d.getUTCDay();
  return g !== 0 && g !== 6;
}

/** Hafta sonuna denk gelen başlangıcı sonraki pazartesiye taşır. */
export function ilkIsGunu(t: string): string {
  let d = tarih(t);
  while (!isGunuMu(d)) d = new Date(d.getTime() + GUN);
  return metin(d);
}

/**
 * `sure` iş günü süren işin bittiği gün. Başlangıç günü 1. iş günüdür:
 * 1 günlük iş aynı gün, 23,8 günlük iş 24. iş gününde biter.
 */
export function bitisTarihi(baslangic: string, sure: number): string {
  let d = tarih(ilkIsGunu(baslangic));
  let kalan = Math.max(1, Math.ceil(sure - 1e-9)) - 1;
  while (kalan > 0) {
    d = new Date(d.getTime() + GUN);
    if (isGunuMu(d)) kalan--;
  }
  return metin(d);
}

/** Başlangıçtan hedef tarihe kadar (ikisi dahil) kaç iş günü var. Hedef önceyse 0. */
export function isGunuSay(baslangic: string, hedef: string): number {
  let d = tarih(ilkIsGunu(baslangic));
  const son = tarih(hedef).getTime();
  let n = 0;
  // Uzun aralıklarda hafta hafta ilerle
  while (d.getTime() + 7 * GUN <= son + GUN && isGunuMu(d) && d.getUTCDay() === 1) {
    d = new Date(d.getTime() + 7 * GUN);
    n += 5;
  }
  while (d.getTime() <= son) {
    if (isGunuMu(d)) n++;
    d = new Date(d.getTime() + GUN);
  }
  return n;
}

/** Tarihten önceki (tarih hariç) iş günü sayısı: veri tarihi 25. iş günüyse 24 gün geçmiştir. */
export function gecenIsGunu(baslangic: string, tarih: string): number {
  const onceki = new Date(new Date(tarih + 'T00:00:00Z').getTime() - GUN).toISOString().slice(0, 10);
  return isGunuSay(baslangic, onceki);
}

/** Bugünün tarihi (Türkiye saati), YYYY-MM-DD. */
export function bugun(): string {
  return new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
}
