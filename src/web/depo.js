// Tarayıcı kaydı: kullanıcının projeleri ve değiştirilmiş örnekler yalnız bu tarayıcıda durur.
// Kayıt ve yedek dosyası güven sınırıdır: şema, tür ve uzunluk denetimi yapılır; etkin HTML içeren yedek reddedilir.
// (Ekrana yazarken React zaten kaçışlar; bu denetim kötü niyetli yedeğin kayda hiç girmemesi için.)
import { SINIR, tarihGecerli } from '../cekirdek/ag.ts';

const ANAHTAR = 'termin.v1';
export const YEDEK_SINIRI = 2 * 1024 * 1024;
const ETKIN_HTML = /<\s*script|<\s*iframe|\bon[a-z]+\s*=|javascript:/i;
const KOD = /^[\p{L}\p{N}._-]{1,20}$/u;

function oku() {
  try {
    const ham = localStorage.getItem(ANAHTAR);
    return ham ? JSON.parse(ham) : null;
  } catch {
    return null;
  }
}

export function kayitVarMi() {
  try {
    const k = '__termin_deneme';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/** Tek projeyi temizler. Geçersizse null döner. Kimlik biçimi bozuksa yenisi verilir. */
export function projeTemizle(p, yeniKimlik) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.isler)) return null;
  const metin = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
  const sayiMi = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const id = /^[a-z0-9-]{1,40}$/.test(String(p.id)) ? String(p.id) : yeniKimlik();
  const isler = p.isler.slice(0, SINIR.is).map((is) => {
    const t = {
      kod: metin(is?.kod, 20),
      ad: metin(is?.ad, SINIR.adUzunluk),
      iyimser: sayiMi(is?.iyimser),
      olasi: sayiMi(is?.olasi),
      kotumser: sayiMi(is?.kotumser),
      onculler: Array.isArray(is?.onculler) ? is.onculler.slice(0, SINIR.oncul + 1).map((o) => metin(o, 20)) : [],
    };
    if (is?.sorumlu) t.sorumlu = metin(is.sorumlu, 80);
    if (is?.kategori) t.kategori = metin(is.kategori, 60);
    if (['bekliyor', 'devam', 'bitti'].includes(is?.durum)) t.durum = is.durum;
    if (typeof is?.gerceklesen === 'number' && Number.isFinite(is.gerceklesen)) t.gerceklesen = is.gerceklesen;
    return t;
  });
  const temiz = {
    id,
    ad: metin(p.ad, 120) || 'Proje',
    baslangic: tarihGecerli(String(p.baslangic)) ? String(p.baslangic) : new Date().toISOString().slice(0, 10),
    isler,
  };
  if (p.planTarihi && tarihGecerli(String(p.planTarihi))) temiz.planTarihi = String(p.planTarihi);
  if (p.durumTarihi && tarihGecerli(String(p.durumTarihi))) temiz.durumTarihi = String(p.durumTarihi);
  if (p.aciklama) temiz.aciklama = metin(p.aciklama, 400);
  return temiz;
}

export function yukle() {
  const k = oku();
  const yeni = () => 'p-' + Math.random().toString(36).slice(2, 10);
  if (!k || !Array.isArray(k.projeler)) return { projeler: [], ornekDegisiklik: {} };
  const projeler = k.projeler.map((p) => projeTemizle(p, yeni)).filter(Boolean);
  const ornekDegisiklik = {};
  for (const [id, p] of Object.entries(k.ornekDegisiklik || {})) {
    if (!/^ornek-[a-z]+$/.test(id)) continue;
    const t = projeTemizle(p, () => id);
    if (t) ornekDegisiklik[id] = { ...t, id };
  }
  return { projeler, ornekDegisiklik };
}

export function kaydet(durum) {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify({ surum: 1, projeler: durum.projeler, ornekDegisiklik: durum.ornekDegisiklik }));
    return true;
  } catch {
    return false;
  }
}

/** Yedek dosyası (JSON) → projeler. Hata metni fırlatır. */
export function yedektenOku(metin, yeniKimlik) {
  if (metin.length > YEDEK_SINIRI) throw new Error('2 MB');
  if (ETKIN_HTML.test(metin)) throw new Error('HTML/script');
  let j;
  try {
    j = JSON.parse(metin);
  } catch {
    throw new Error('JSON');
  }
  const liste = Array.isArray(j?.projeler) ? j.projeler : Array.isArray(j?.isler) ? [j] : null;
  if (!liste) throw new Error('projeler');
  if (liste.length > 50) throw new Error('> 50');
  const sonuc = liste.map((p) => projeTemizle(p, yeniKimlik)).filter(Boolean);
  for (const p of sonuc) for (const is of p.isler) if (is.kod && !KOD.test(is.kod)) is.kod = is.kod.replace(/[^\p{L}\p{N}._-]/gu, '').slice(0, 20) || 'X';
  if (!sonuc.length) throw new Error('0');
  return sonuc;
}

export function yedekMetni(projeler) {
  return JSON.stringify({ uygulama: 'termin-olasiligi', surum: 1, tarih: new Date().toISOString(), projeler }, null, 2);
}
