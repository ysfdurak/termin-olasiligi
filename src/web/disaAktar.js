// Excel dışa aktarma: sonuç özeti, işler (kritiklik ve duyarlılıkla), eğri. Ayrıca boş şablon.
import { SABLON_BASLIKLARI, projedenSatirlar } from '../cekirdek/ice-aktar.ts';
import { bitisTarihi } from '../cekirdek/takvim.ts';

const B = {
  tr: { ozet: 'Sonuç', isler: 'İşler', egri: 'Eğri', aciklama: 'Açıklama', olcu: 'Ölçü', deger: 'İş günü', tarih: 'Tarih', olasilik: 'Olasılık', kritiklik: 'kritiklik', duyarlilik: 'duyarlilik' },
  en: { ozet: 'Result', isler: 'Tasks', egri: 'Curve', aciklama: 'Notes', olcu: 'Measure', deger: 'Working days', tarih: 'Date', olasilik: 'Probability', kritiklik: 'criticality', duyarlilik: 'sensitivity' },
};

export function sonucSayfalari(p, s, dil) {
  const b = B[dil] || B.tr;
  const tr = dil !== 'en';
  const gunH = (gun) => ({ v: Math.round(gun * 10) / 10, ondalik: true }); // iş günü sütunu hep bir ondalıklı
  const satir = (ad, gun, olas) => [ad, gunH(gun), bitisTarihi(p.baslangic, gun), olas ?? ''];
  const ozet = [
    [b.olcu, b.deger, b.tarih, b.olasilik],
    [tr ? 'Proje' : 'Project', p.ad, '', ''],
    [tr ? 'Başlangıç' : 'Start', '', p.baslangic, ''],
    satir(tr ? '%50 ihtimalle bitiş' : '50% finish', s.p50, 0.5),
    satir(tr ? '%85 ihtimalle bitiş' : '85% finish', s.p85, 0.85),
    satir(tr ? '%95 ihtimalle bitiş' : '95% finish', s.p95, 0.95),
    satir(tr ? 'En olası sürelerle plan' : 'Plan with most likely durations', s.deterministik),
    satir(tr ? 'Klasik PERT %85' : 'Classic PERT 85%', s.pert.p85),
  ];
  if (p.planTarihi && s.plan) ozet.push([tr ? 'Plan tarihinin tutma olasılığı' : 'Chance of meeting the committed date', gunH(s.plan.gun), p.planTarihi, s.plan.olasilik]);
  ozet.push([tr ? 'Tur sayısı / tohum' : 'Runs / seed', s.tur, String(s.tohum), '']);
  const kr = Object.fromEntries(s.isler.map((x) => [x.kod, x]));
  const isler = [[...SABLON_BASLIKLARI, b.kritiklik, b.duyarlilik], ...projedenSatirlar(p).map((r) => [...r, kr[r[0]]?.kritiklik ?? '', Math.round((kr[r[0]]?.duyarlilik ?? 0) * 100) / 100])];
  const egri = [[b.deger, b.tarih, b.olasilik], ...s.egri.filter((_, i) => i % 5 === 0).map(([g, o]) => [gunH(g), bitisTarihi(p.baslangic, g), o])];
  return [
    { ad: b.ozet, satirlar: ozet, genislik: [38, 16, 14, 12], yuzde: [3] },
    { ad: b.isler, satirlar: isler, genislik: [8, 40, 12, 12, 12, 12, 18, 14, 10, 14, 11, 11], yuzde: [10] },
    { ad: b.egri, satirlar: egri, genislik: [14, 14, 12], yuzde: [2] },
  ];
}

export function sablonSayfalari(ornek, dil) {
  const tr = dil !== 'en';
  const aciklama = tr
    ? [
        ['Sütun', 'Zorunlu', 'Açıklama'],
        ['is_kodu', 'Hayır', 'Benzersiz kısa kod (A, B, 1, 2…). Yoksa satır numarası kullanılır.'],
        ['is_adi', 'Evet', 'İşin adı'],
        ['iyimser_gun', 'Evet', 'Her şey yolunda giderse kaç iş günü'],
        ['olasi_gun', 'Evet', 'En olası süre'],
        ['kotumser_gun', 'Evet', 'Ciddi bir sorun çıkarsa'],
        ['onculler', 'Hayır', 'Önce bitmesi gereken işlerin kodları, virgülle (B,C)'],
        ['sorumlu', 'Hayır', 'Kişi ya da ekip; aynı anda yürüyebilen işler uyarı verir'],
        ['kategori', 'Hayır', 'İş türü (V2 kalibrasyonu bununla gruplanır)'],
        ['durum', 'Hayır', 'Bekliyor / Devam / Bitti'],
        ['gerceklesen_gun', 'Hayır', 'Biten işin gerçek süresi; hesapta tahmin yerine bu kullanılır'],
        ['', '', ''],
        ['Pusula', '', 'Pusula’nın Excel dışa aktarması da okunur (İş, Durum, Sorumlular, Başlangıç, Tamamlanma). Üç tahmin sütununu eklemen yeterli.'],
      ]
    : [
        ['Column', 'Required', 'Description'],
        ['is_kodu', 'No', 'Short unique code (A, B, 1, 2…). Row number is used if missing.'],
        ['is_adi', 'Yes', 'Task name'],
        ['iyimser_gun', 'Yes', 'Working days if everything goes well'],
        ['olasi_gun', 'Yes', 'Most likely duration'],
        ['kotumser_gun', 'Yes', 'If a serious problem occurs'],
        ['onculler', 'No', 'Codes of tasks that must finish first, comma separated (B,C)'],
        ['sorumlu', 'No', 'Person or team; tasks that can overlap are flagged'],
        ['kategori', 'No', 'Task type (V2 calibration groups by this)'],
        ['durum', 'No', 'Bekliyor / Devam / Bitti (or Waiting / In progress / Done)'],
        ['gerceklesen_gun', 'No', 'Actual duration of a finished task; used instead of the estimate'],
        ['', '', ''],
        ['English headers', '', 'task_id, task_name, optimistic, most_likely, pessimistic, predecessors, owner, category, status, actual also work.'],
      ];
  return [
    { ad: tr ? 'İşler' : 'Tasks', satirlar: [SABLON_BASLIKLARI, ...projedenSatirlar(ornek)], genislik: [8, 32, 12, 12, 12, 12, 16, 14, 10, 14] },
    { ad: tr ? 'Açıklama' : 'Notes', satirlar: aciklama, genislik: [18, 10, 90] },
  ];
}
