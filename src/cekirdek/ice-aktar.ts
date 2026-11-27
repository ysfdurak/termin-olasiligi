// İçe aktarma: Excel/CSV satırlarından proje. Başlıklar esnek eşlenir (Türkçe, İngilizce, Pusula dışa aktarması).
// Bu bir güven sınırıdır: her değer tür, uzunluk ve aralık denetiminden geçer; hatalı satır projeyi bozmaz,
// doğrulama bulgusu olarak görünür.
import { SINIR, tarihGecerli } from './ag.ts';
import { isGunuSay } from './takvim.ts';
import type { Durum, Is, Proje } from './tipler.ts';

export const METIN_SINIRI = 2_000_000; // 2 MB CSV metni
export const SATIR_SINIRI = SINIR.is;

type Alan =
  | 'kod' | 'ad' | 'iyimser' | 'olasi' | 'kotumser' | 'onculler' | 'sorumlu' | 'kategori' | 'durum' | 'gerceklesen' | 'basladi' | 'bitti';

const ESLER: Record<Alan, string[]> = {
  kod: ['is_kodu', 'kod', 'is_kod', 'kodu', 'id', 'no', 'task_id', 'key', 'code', 'wbs'],
  ad: ['is_adi', 'ad', 'adi', 'is', 'baslik', 'gorev', 'gorev_adi', 'task', 'task_name', 'name', 'title', 'summary'],
  iyimser: ['iyimser_gun', 'iyimser', 'en_iyi', 'optimistic', 'optimistic_days', 'min', 'best_case'],
  olasi: ['olasi_gun', 'olasi', 'en_olasi', 'most_likely', 'most_likely_days', 'likely', 'tahmin', 'tahmini_sure', 'estimate'],
  kotumser: ['kotumser_gun', 'kotumser', 'en_kotu', 'pessimistic', 'pessimistic_days', 'max', 'worst_case'],
  onculler: ['onculler', 'oncul', 'oncul_isler', 'bagimlilik', 'bagimliliklar', 'predecessors', 'predecessor', 'depends_on', 'dependencies'],
  sorumlu: ['sorumlu', 'sorumlular', 'atanan', 'kisi', 'assignee', 'assignees', 'owner'],
  kategori: ['kategori', 'is_turu', 'tur', 'ekip', 'category', 'type', 'team'],
  durum: ['durum', 'status', 'state'],
  gerceklesen: ['gerceklesen_gun', 'gerceklesen', 'gercek_sure', 'gercek', 'actual', 'actual_days'],
  basladi: ['baslangic', 'baslama', 'baslangic_tarihi', 'start', 'start_date'],
  bitti: ['tamamlanma', 'bitis', 'bitis_tarihi', 'tamamlanma_tarihi', 'finish', 'finish_date', 'completed', 'done_date'],
};

/** Başlık metnini karşılaştırılabilir biçime getirir: "İyimser (gün)" → "iyimser_gun". */
export function basligiSadelestir(b: string): string {
  return String(b ?? '')
    .replace(/[İI]/g, 'i')
    .replace(/ı/g, 'i')
    .toLocaleLowerCase('tr')
    .replace(/[ğ]/g, 'g')
    .replace(/[ü]/g, 'u')
    .replace(/[ş]/g, 's')
    .replace(/[ö]/g, 'o')
    .replace(/[ç]/g, 'c')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function basliklariEsle(basliklar: string[]): Partial<Record<Alan, string>> {
  const sade = basliklar.map((b) => ({ ham: b, s: basligiSadelestir(b) }));
  const sonuc: Partial<Record<Alan, string>> = {};
  const kullanildi = new Set<string>();
  for (const alan of Object.keys(ESLER) as Alan[]) {
    for (const aday of ESLER[alan]) {
      const bulunan = sade.find((x) => (x.s === aday || x.s === aday + '_gun' || x.s === aday + '_days') && !kullanildi.has(x.ham));
      if (bulunan) {
        sonuc[alan] = bulunan.ham;
        kullanildi.add(bulunan.ham);
        break;
      }
    }
  }
  return sonuc;
}

/** "2,5" → 2.5; boş → undefined; sayı değilse NaN (doğrulama "sayı değil" der). */
export function sayiOku(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s) return undefined;
  const t = s.replace(/\s/g, '').replace(/^(\d{1,3}(?:\.\d{3})+),(\d+)$/, (_m, a, b) => a.replace(/\./g, '') + '.' + b).replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** "2026-03-12", "12.03.2026", "12/03/2026" → "2026-03-12". */
export function tarihOku(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  // Excel tarih seri numarası (1900 sistemi): 46000 → 2025-12-09
  if (typeof v === 'number') return v > 20000 && v < 80000 ? new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10) : undefined;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return tarihGecerli(`${m[1]}-${m[2]}-${m[3]}`) ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) {
    const t = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return tarihGecerli(t) ? t : undefined;
  }
  return undefined;
}

export function durumOku(v: unknown): Durum | 'iptal' {
  const s = basligiSadelestir(String(v ?? ''));
  if (/^(bitti|tamam|tamamlandi|kapandi|done|completed|closed|finished)$/.test(s)) return 'bitti';
  if (/^(devam|devam_ediyor|suruyor|in_progress|doing|started|active)$/.test(s)) return 'devam';
  if (/^(iptal|cancelled|canceled)$/.test(s)) return 'iptal';
  return 'bekliyor';
}

function kirp(v: unknown, n: number): string {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
}

export interface AktarmaRaporu {
  proje: Proje;
  eslesen: Partial<Record<Alan, string>>;
  eksik: Alan[];
  satir: number;
  atlanan: { bos: number; iptal: number };
  /** Gerçekleşen süre Pusula'daki Başlangıç/Tamamlanma tarihlerinden hesaplandıysa adet. */
  tarihtenHesaplanan: number;
  otomatikKod: boolean;
}

/**
 * Satırlardan proje kurar. Zorunlu alanlar: iş adı ve üç tahmin. Kod sütunu yoksa satır sırası kod olur
 * (öncüller de satır numarasıyla yazılabilir). Fazla satır sessizce kesilmez: hata döner.
 */
export function satirlardanProje(satirlar: Record<string, unknown>[], ust: { id: string; ad: string; baslangic: string; planTarihi?: string }): AktarmaRaporu {
  if (satirlar.length > SATIR_SINIRI) throw new Error(`En çok ${SATIR_SINIRI} iş içe aktarılabilir (dosyada ${satirlar.length} satır var).`);
  const basliklar = [...new Set(satirlar.flatMap((s) => Object.keys(s)))];
  const e = basliklariEsle(basliklar);
  const eksik = (['ad', 'iyimser', 'olasi', 'kotumser'] as Alan[]).filter((a) => !e[a]);
  const otomatikKod = !e.kod;
  const isler: Is[] = [];
  const atlanan = { bos: 0, iptal: 0 };
  let tarihtenHesaplanan = 0;
  satirlar.forEach((s, i) => {
    const al = (a: Alan) => (e[a] ? s[e[a] as string] : undefined);
    const ad = kirp(al('ad'), SINIR.adUzunluk);
    const kod = otomatikKod ? String(i + 1) : kirp(al('kod'), 40);
    const bos = !ad && !kod && [al('iyimser'), al('olasi'), al('kotumser')].every((x) => x === undefined || String(x).trim() === '');
    if (bos) return void atlanan.bos++;
    const durum = e.durum ? durumOku(al('durum')) : undefined;
    if (durum === 'iptal') return void atlanan.iptal++;
    const is: Is = {
      kod,
      ad,
      iyimser: sayiOku(al('iyimser')) ?? NaN,
      olasi: sayiOku(al('olasi')) ?? NaN,
      kotumser: sayiOku(al('kotumser')) ?? NaN,
      onculler: kirp(al('onculler'), 2000)
        .split(/[,;\s]+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, SINIR.oncul + 1),
    };
    const sorumlu = kirp(al('sorumlu'), 80);
    if (sorumlu) is.sorumlu = sorumlu;
    const kategori = kirp(al('kategori'), 60);
    if (kategori) is.kategori = kategori;
    if (durum) is.durum = durum;
    let g = sayiOku(al('gerceklesen'));
    if (durum === 'bitti' && g === undefined) {
      const b1 = tarihOku(al('basladi'));
      const b2 = tarihOku(al('bitti'));
      if (b1 && b2 && b2 >= b1) {
        g = isGunuSay(b1, b2);
        tarihtenHesaplanan++;
      }
    }
    if (g !== undefined && Number.isFinite(g)) is.gerceklesen = g;
    // Bitmiş ve gerçek süresi bilinen işte tahmin zorunlu değil (simülasyon gerçek süreyi kullanır).
    if (is.durum === 'bitti' && is.gerceklesen !== undefined) {
      for (const k of ['iyimser', 'olasi', 'kotumser'] as const) if (!Number.isFinite(is[k])) is[k] = is.gerceklesen;
    }
    isler.push(is);
  });
  const proje: Proje = { id: ust.id, ad: kirp(ust.ad, 120) || 'Yeni proje', baslangic: ust.baslangic, isler };
  if (ust.planTarihi) proje.planTarihi = ust.planTarihi;
  return { proje, eslesen: e, eksik, satir: satirlar.length, atlanan, tarihtenHesaplanan, otomatikKod };
}

/** CSV/TSV metnini satır nesnelerine çevirir. Ayırıcı (; , sekme) ilk satırdan bulunur. */
export function csvOku(metin: string): Record<string, string>[] {
  if (metin.length > METIN_SINIRI) throw new Error('Dosya çok büyük (en çok 2 MB).');
  const t = metin.replace(/^﻿/, '');
  const ilk = t.split(/\r?\n/, 1)[0] || '';
  const ayirici = [';', '\t', ','].map((a) => ({ a, n: ilk.split(a).length })).sort((x, y) => y.n - x.n)[0].a;
  const satirlar: string[][] = [];
  let alan = '';
  let satir: string[] = [];
  let tirnak = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (tirnak) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          alan += '"';
          i++;
        } else tirnak = false;
      } else alan += c;
    } else if (c === '"' && alan === '') tirnak = true;
    else if (c === ayirici) {
      satir.push(alan);
      alan = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      satir.push(alan);
      satirlar.push(satir);
      satir = [];
      alan = '';
      if (satirlar.length > SATIR_SINIRI + 1) throw new Error(`En çok ${SATIR_SINIRI} iş içe aktarılabilir.`);
    } else alan += c;
  }
  if (alan !== '' || satir.length) {
    satir.push(alan);
    satirlar.push(satir);
  }
  const dolu = satirlar.filter((s) => s.some((x) => x.trim() !== ''));
  if (!dolu.length) return [];
  const bas = dolu[0].map((b, i) => b.trim() || `Sütun ${i + 1}`);
  return dolu.slice(1).map((s) => Object.fromEntries(bas.map((b, i) => [b, s[i] ?? ''])));
}

/** Projeyi kapsam dokümanındaki şablon sütunlarıyla satırlara çevirir (dışa aktarma ve şablon). */
export const SABLON_BASLIKLARI = ['is_kodu', 'is_adi', 'iyimser_gun', 'olasi_gun', 'kotumser_gun', 'onculler', 'sorumlu', 'kategori', 'durum', 'gerceklesen_gun'];

export function projedenSatirlar(p: Proje): (string | number)[][] {
  const durumAd = { bekliyor: 'Bekliyor', devam: 'Devam', bitti: 'Bitti' } as const;
  return p.isler.map((is) => [
    is.kod,
    is.ad,
    is.iyimser,
    is.olasi,
    is.kotumser,
    is.onculler.join(','),
    is.sorumlu || '',
    is.kategori || '',
    is.durum ? durumAd[is.durum] : '',
    is.gerceklesen ?? '',
  ]);
}

/** CSV hücresi: formül enjeksiyonuna karşı =, +, -, @, sekme ile başlayan METİN başına ' eklenir; sayılar olduğu gibi kalır. */
export function csvHucre(v: string | number): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v).replace('.', ',') : '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function csvYaz(basliklar: string[], satirlar: (string | number)[][]): string {
  return '﻿' + [basliklar, ...satirlar].map((r) => r.map(csvHucre).join(';')).join('\r\n') + '\r\n';
}
