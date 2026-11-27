// Çekirdeğin dış yüzü: web, Worker ve MCP yalnızca buradan alır.
export * from './tipler.ts';
export { dogrula, hataVar, bittiMi, siraBul, SINIR, tarihGecerli } from './ag.ts';
export { simuleEt, deterministikPlan, klasikPert, yuzdelik, olasilik, VARSAYILAN_TUR, EN_COK_TUR } from './simulasyon.ts';
export { senaryoDene, senaryoUygula } from './senaryo.ts';
export type { Degisiklik, SenaryoSonucu } from './senaryo.ts';
export { tahminSapmasi, KALIBRASYON_ESIGI } from './sapma.ts';
export { bitisTarihi, isGunuSay, ilkIsGunu, bugun } from './takvim.ts';
export { csvOku, csvYaz, csvHucre, satirlardanProje, projedenSatirlar, SABLON_BASLIKLARI, basliklariEsle, sayiOku, tarihOku } from './ice-aktar.ts';
export type { AktarmaRaporu } from './ice-aktar.ts';
export { ornekProjeler, ORNEK_KIMLIKLER } from './ornekler.ts';
export { bulguMetni } from './metin.ts';
