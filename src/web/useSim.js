// Simülasyonu Worker'da çalıştıran kanca. Proje değiştikçe kısa bir beklemeden sonra yeniden hesaplar.
// Worker yoksa (çok eski tarayıcı) aynı çekirdek ana iş parçacığında çalışır.
import { useEffect, useRef, useState } from 'react';
import { simuleEt } from '../cekirdek/simulasyon.ts';
import { senaryoDene } from '../cekirdek/senaryo.ts';
import { olay } from './olcum.js';

let worker = null;
let sayac = 0;
const bekleyen = new Map();

function calistir(mesaj) {
  if (!worker && typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('./sim.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const b = bekleyen.get(e.data.no);
        bekleyen.delete(e.data.no);
        if (b) e.data.hata ? b.reddet(new Error(e.data.hata)) : b.coz(e.data.sonuc);
      };
    } catch {
      worker = null;
    }
  }
  if (!worker) {
    return new Promise((coz, reddet) => {
      try {
        coz(mesaj.tip === 'senaryo' ? senaryoDene(mesaj.proje, mesaj.degisiklikler, { tur: mesaj.tur }) : simuleEt(mesaj.proje, { tur: mesaj.tur }));
      } catch (e) {
        reddet(e);
      }
    });
  }
  const no = ++sayac;
  return new Promise((coz, reddet) => {
    bekleyen.set(no, { coz, reddet });
    worker.postMessage({ ...mesaj, no });
  });
}

export function senaryoHesapla(proje, degisiklikler, tur) {
  olay('senaryo');
  return calistir({ tip: 'senaryo', proje, degisiklikler, tur });
}

export function useSim(proje, tur, gecerli) {
  const [durum, setDurum] = useState({ sonuc: null, hesapliyor: false, hata: null });
  const son = useRef(0);
  useEffect(() => {
    if (!gecerli) return setDurum((d) => ({ ...d, hesapliyor: false }));
    const no = ++son.current;
    setDurum((d) => ({ ...d, hesapliyor: true }));
    const zaman = setTimeout(() => {
      calistir({ tip: 'sim', proje, tur })
        .then((sonuc) => {
          if (no !== son.current) return;
          setDurum({ sonuc, hesapliyor: false, hata: null });
          olay('simulasyon');
        })
        .catch((e) => no === son.current && setDurum({ sonuc: null, hesapliyor: false, hata: String(e.message || e) }));
    }, 250);
    return () => clearTimeout(zaman);
  }, [proje, tur, gecerli]);
  return durum;
}
