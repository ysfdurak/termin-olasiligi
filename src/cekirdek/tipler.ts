// Termin Olasılığı çekirdeğinin veri tipleri.
// Çekirdek bağımlılıksızdır; web arayüzü, Web Worker ve MCP sunucusu aynı dosyaları çağırır.
// Yalnız "silinebilir" TypeScript sözdizimi kullanılır (enum, namespace, parametre özelliği yok):
// Node bu dosyaları derlemeden çalıştırır (tip ayıklama), Vite de aynı dosyaları paketler.

export type Durum = 'bekliyor' | 'devam' | 'bitti';

/** Projedeki tek bir iş. Süreler iş günüdür. */
export interface Is {
  kod: string;
  ad: string;
  iyimser: number;
  olasi: number;
  kotumser: number;
  /** Önce bitmesi gereken işlerin kodları (yalnız "bitiş → başlangıç" bağımlılığı). */
  onculler: string[];
  sorumlu?: string;
  kategori?: string;
  durum?: Durum;
  /** Biten işin gerçek süresi. Bitmiş işte tahmin yerine bu kullanılır. */
  gerceklesen?: number;
}

export interface Proje {
  id: string;
  ad: string;
  /** İlk iş gününün tarihi, YYYY-MM-DD. */
  baslangic: string;
  /** Söz verilen tarih (isteğe bağlı), YYYY-MM-DD. */
  planTarihi?: string;
  /**
   * Veri tarihi (YYYY-MM-DD, isteğe bağlı): sürmekte olan projede "bugün". Bitmemiş işler bu tarihten önce
   * başlayamaz, devam eden işler bu tarihten önce bitemez. Verilmezse proje başlamamış sayılır.
   */
  durumTarihi?: string;
  aciklama?: string;
  isler: Is[];
}

/** Doğrulama bulgusu. Metin değil kod döner; arayüz ve MCP kendi dilinde yazar. */
export interface Bulgu {
  seviye: 'hata' | 'uyari';
  kod:
    | 'bos_proje'
    | 'cok_is'
    | 'kod_bos'
    | 'kod_bicim'
    | 'kod_tekrar'
    | 'ad_bos'
    | 'sayi_degil'
    | 'negatif'
    | 'sira'
    | 'cok_buyuk'
    | 'bilinmeyen_oncul'
    | 'kendine_oncul'
    | 'cok_oncul'
    | 'dongu'
    | 'tek_nokta'
    | 'kopuk'
    | 'cakisan_sorumlu'
    | 'tarih_bicim'
    | 'plan_once';
  isler?: string[];
  deger?: string;
}

export interface IsSonucu {
  kod: string;
  ad: string;
  /** Turların ne kadarında kritik yoldaydı (0–1). */
  kritiklik: number;
  /** İş süresi ile proje süresi arasındaki korelasyon (−1…1). */
  duyarlilik: number;
  ortalama: number;
  sabit: boolean;
}

export interface TekTur {
  sureler: Record<string, number>;
  baslangic: Record<string, number>;
  bitis: Record<string, number>;
  kritikYol: string[];
  toplam: number;
}

export interface Sonuc {
  tur: number;
  tohum: number;
  ortalama: number;
  stdSapma: number;
  enKisa: number;
  enUzun: number;
  /** Yüzdelikler (iş günü). */
  p50: number;
  p85: number;
  p95: number;
  /** En olası değerlerle (üç noktalı tahminin ortası) yapılan klasik plan. */
  deterministik: number;
  deterministikYol: string[];
  /** Klasik PERT: tek kritik yol, normal yaklaşım. */
  pert: { ortalama: number; stdSapma: number; p85: number; yol: string[] };
  /** Plan tarihi verilmişse: o tarihe kadar kaç iş günü var ve tutma olasılığı. */
  plan?: { gun: number; olasilik: number };
  /** İstenen hedef tarih (iş günü) için yetişme olasılığı. */
  hedef?: { gun: number; olasilik: number };
  isler: IsSonucu[];
  /** Birikimli olasılık eğrisi: [iş günü, olasılık] çiftleri. */
  egri: [number, number][];
  /** Histogram: [kutu başı, kutu sonu, adet]. */
  histogram: [number, number, number][];
  /** Açıklama panelinde gösterilen ilk tur. */
  ornekTur: TekTur;
  /** Veri tarihine kadar geçen iş günü (verilmişse). */
  gecenGun?: number;
  sureMs: number;
}

export interface SimSecenek {
  tur?: number;
  tohum?: number;
  /** Yetişme olasılığı sorulan iş günü sayısı. */
  hedefGun?: number;
}
