// Anonim kullanım ölçümü ve geri bildirim düğmesi (ortak servis: olcum.ysfdurak.com; kaynak: ysfdurak.com → sunucu/olcum).
// Yalnız resmî demo adresinde yüklenir: kendi sunucusuna kurulan kopyalar dışarıya hiç istek atmaz.
// Gönderilenler: sabit ekran adı (projeler, sonuc, isler, senaryo, nasil), sabit işlem adı, aktif süre, cihaz türü, dil.
// Proje adı, iş adı, tahminler, yüklenen dosya gönderilmez; çerez yok; DNT/GPC'ye uyar.
export const OLCUM_ACIK = typeof location !== 'undefined' && location.hostname === 'termin.ysfdurak.com';

export function olcumYukle(dil) {
  if (!OLCUM_ACIK || document.querySelector('script[data-proje="termin"]')) return;
  const s = document.createElement('script');
  s.src = 'https://olcum.ysfdurak.com/olcum.js';
  s.defer = true;
  s.dataset.proje = 'termin';
  if (dil === 'en') s.dataset.dil = 'en';
  document.head.appendChild(s);
}

const EKRANLAR = new Set(['projeler', 'sonuc', 'isler', 'senaryo', 'nasil']);
const OLAYLAR = new Set(['simulasyon', 'senaryo', 'excel_yukle', 'yeni_proje', 'is_ekle', 'disa_aktar', 'sablon_indir', 'yedek_yukle', 'dil_degisti']);

function gonder(tur, ad) {
  if (!OLCUM_ACIK) return;
  if (window.olcum && window.olcum[tur]) window.olcum[tur](ad);
  else (window.olcumKuyruk ||= []).push([tur, ad]);
}

export function ekran(ad) {
  if (EKRANLAR.has(ad)) gonder('ekran', ad);
}

export function olay(ad) {
  if (OLAYLAR.has(ad)) gonder('olay', 'islem:' + ad);
}
