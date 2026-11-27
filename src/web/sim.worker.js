// Simülasyon Web Worker'da çalışır: 10.000+ tur sayfayı dondurmaz. Çekirdek, sunucudakiyle aynı dosyadır.
import { simuleEt } from '../cekirdek/simulasyon.ts';
import { senaryoDene } from '../cekirdek/senaryo.ts';

self.onmessage = (e) => {
  const { no, tip, proje, tur, degisiklikler } = e.data || {};
  try {
    const sonuc = tip === 'senaryo' ? senaryoDene(proje, degisiklikler, { tur }) : simuleEt(proje, { tur });
    self.postMessage({ no, sonuc });
  } catch (err) {
    self.postMessage({ no, hata: String(err?.message || err) });
  }
};
