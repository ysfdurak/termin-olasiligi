// Hazır örnek projeler (Yıldız Ev & Yaşam evreni; veriler kurgusal).
// Tarihler bugüne göre kurulur: demo her gün "yakında başlayacak" ya da "sürmekte olan" proje gösterir.
// Tohum proje kimliğinden geldiği için sonuçlar (iş günü cinsinden) her gün aynıdır.
import { deterministikPlan } from './simulasyon.ts';
import { bitisTarihi, bugun } from './takvim.ts';
import type { Is, Proje } from './tipler.ts';

type Dil = 'tr' | 'en';
type Satir = [kod: string, ad: [tr: string, en: string], a: number, m: number, b: number, onc: string, sorumlu?: string, kategori?: string, gerceklesen?: number, durum?: 'devam'];

const EN: Record<string, string> = {
  'Süreç geliştirme': 'Process improvement', 'Veri analizi': 'Data analysis', BT: 'IT', 'Depo operasyon': 'Warehouse operations', Eğitim: 'Training',
  'Analiz ekibi': 'Analysis team', 'Veri ekibi': 'Data team', 'BI ekibi': 'BI team',
  Analiz: 'Analysis', Geliştirme: 'Development', Test: 'Testing', Saha: 'Floor', Veri: 'Data', Altyapı: 'Infrastructure',
};

function isler(satirlar: Satir[], dil: Dil): Is[] {
  return satirlar.map(([kod, [adTr, adEn], a, m, b, onc, sorumlu, kategori, g, durum]) => {
    const is: Is = { kod, ad: dil === 'en' ? adEn : adTr, iyimser: a, olasi: m, kotumser: b, onculler: onc ? onc.split(',') : [] };
    if (sorumlu) is.sorumlu = dil === 'en' ? EN[sorumlu] || sorumlu : sorumlu;
    if (kategori) is.kategori = dil === 'en' ? EN[kategori] || kategori : kategori;
    if (g !== undefined) {
      is.durum = 'bitti';
      is.gerceklesen = g;
    } else if (durum) is.durum = durum;
    return is;
  });
}

function pazartesi(t: string, haftaKaydir: number): string {
  const d = new Date(t + 'T00:00:00Z');
  const g = (d.getUTCDay() + 6) % 7; // pazartesi = 0
  return new Date(d.getTime() + (-g + 7 * haftaKaydir) * 86400000).toISOString().slice(0, 10);
}

/**
 * Planı proje başında "en olası sürelerle" yapılmış gibi kurar: plan tarihi = klasik planın bittiği gün.
 * Biten işlerin gerçek süreleri plana girmez (plan yapılırken bilinmiyordu); kayma böylece görünür.
 */
function planla(p: Proje): Proje {
  const { durumTarihi: _v, ...bas } = p;
  const ilkPlan = { ...bas, isler: p.isler.map(({ durum: _d, gerceklesen: _g, ...is }) => is) };
  return { ...p, planTarihi: bitisTarihi(p.baslangic, deterministikPlan(ilkPlan).toplam) };
}

export const ORNEK_KIMLIKLER = ['ornek-yontem', 'ornek-iade', 'ornek-panel'] as const;

export function ornekProjeler(bugunTarih: string = bugun(), dil: Dil = 'tr'): Proje[] {
  const d = (tr: string, en: string) => (dil === 'en' ? en : tr);
  const gelecek = pazartesi(bugunTarih, 1);
  const gecmis = pazartesi(bugunTarih, -4);
  return [
    planla({
      id: 'ornek-yontem',
      ad: d('Yöntem örneği (5 iş)', 'Method example (5 tasks)'),
      aciklama: d('Elle çözülmüş yöntem örneği: A bitince B ve C paralel, ikisi bitince D, sonra E.', 'The hand-worked method example: after A, B and C run in parallel; D waits for both, then E.'),
      baslangic: gelecek,
      isler: isler([
        ['A', ['Gereksinim analizi', 'Requirements analysis'], 2, 3, 6, ''],
        ['B', ['Tasarım', 'Design'], 3, 5, 10, 'A'],
        ['C', ['Veri hazırlığı', 'Data preparation'], 4, 6, 8, 'A'],
        ['D', ['Geliştirme', 'Development'], 8, 10, 16, 'B,C'],
        ['E', ['Test ve canlı', 'Testing and go-live'], 2, 3, 7, 'D'],
      ], dil),
    }),
    planla({
      id: 'ornek-iade',
      ad: d('İade sürecinin yeniden tasarımı', 'Returns process redesign'),
      aciklama: d('Yıldız Ev & Yaşam deposu. Sıfırdan proje: yalnızca üç noktalı tahmin var. Sistem ve saha olmak üzere iki paralel kol.', 'Yıldız Ev & Yaşam warehouse. A new project with three-point estimates only. Two parallel streams: systems and floor.'),
      baslangic: gelecek,
      isler: isler([
        ['A', ['Mevcut iade sürecinin haritalanması', 'Map the current returns process'], 2, 3, 5, '', 'Süreç geliştirme', 'Analiz'],
        ['B', ['Son 6 ayın iade nedenleri analizi', 'Analyse return reasons (last 6 months)'], 3, 4, 8, 'A', 'Veri analizi', 'Analiz'],
        ['C', ['Yeni süreç tasarımı ve onay', 'Design and approve the new process'], 3, 5, 9, 'B', 'Süreç geliştirme', 'Analiz'],
        ['D', ['WMS iade ekranı gereksinimleri', 'WMS returns screen requirements'], 2, 3, 5, 'C', 'BT', 'Geliştirme'],
        ['E', ['WMS iade ekranı geliştirme (tedarikçi)', 'WMS returns screen build (vendor)'], 8, 12, 22, 'D', 'BT', 'Geliştirme'],
        ['F', ['Kullanıcı kabul testi', 'User acceptance testing'], 2, 3, 6, 'E', 'BT', 'Test'],
        ['G', ['İade alanı yerleşim planı', 'Returns area layout plan'], 2, 3, 4, 'C', 'Depo operasyon', 'Saha'],
        ['H', ['Raf ve tezgâh kurulumu', 'Install racks and benches'], 4, 6, 12, 'G', 'Depo operasyon', 'Saha'],
        ['I', ['Talimatlar ve görsel standartlar', 'Work instructions and visual standards'], 2, 3, 5, 'G', 'Süreç geliştirme', 'Saha'],
        ['J', ['Ekip eğitimi (iki vardiya)', 'Team training (two shifts)'], 2, 3, 4, 'H,I', 'Eğitim', 'Eğitim'],
        ['K', ['Pilot uygulama (bir hafta)', 'Pilot run (one week)'], 5, 5, 8, 'F,J', 'Depo operasyon', 'Saha'],
        ['L', ['Pilot değerlendirme ve düzeltmeler', 'Pilot review and fixes'], 2, 3, 6, 'K', 'Süreç geliştirme', 'Analiz'],
        ['M', ['Tam geçiş', 'Full rollout'], 1, 2, 4, 'L', 'Depo operasyon', 'Saha'],
      ], dil),
    }),
    planla({
      id: 'ornek-panel',
      ad: d('Depo performans paneli devreye alma', 'Warehouse performance dashboard rollout'),
      aciklama: d('Sürmekte olan proje: ilk işler bitti, gerçek süreleri girildi. Veri, pano ve altyapı olmak üzere üç paralel kol.', 'A project under way: the first tasks are done and their actual durations entered. Three parallel streams: data, dashboard and infrastructure.'),
      baslangic: gecmis,
      durumTarihi: bugunTarih,
      isler: isler([
        ['A', ['Kapsam ve KPI tanımları', 'Scope and KPI definitions'], 3, 4, 7, '', 'Analiz ekibi', 'Analiz', 5],
        ['B', ['Veri kaynakları envanteri', 'Data source inventory'], 2, 3, 5, 'A', 'Veri ekibi', 'Veri', 4],
        ['C', ['WMS veri çekme (SQL görünümleri)', 'WMS data extraction (SQL views)'], 4, 6, 10, 'B', 'Veri ekibi', 'Geliştirme', 9],
        ['D', ['Veri ambarı tabloları', 'Data warehouse tables'], 5, 7, 12, 'C', 'Veri ekibi', 'Geliştirme', undefined, 'devam'],
        ['E', ['Veri kalite kontrolleri', 'Data quality checks'], 2, 3, 6, 'D', 'Veri ekibi', 'Test'],
        ['F', ['Pano taslağı', 'Dashboard wireframe'], 2, 3, 5, 'A', 'Analiz ekibi', 'Analiz', 3],
        ['G', ['Kullanıcı görüşmeleri (vardiya amirleri)', 'User interviews (shift supervisors)'], 2, 3, 4, 'F', 'Analiz ekibi', 'Analiz', 4],
        ['H', ['Power BI veri modeli', 'Power BI data model'], 4, 6, 11, 'G,D', 'BI ekibi', 'Geliştirme'],
        ['I', ['Ölçüler (DAX)', 'Measures (DAX)'], 4, 5, 10, 'H', 'BI ekibi', 'Geliştirme'],
        ['J', ['Görseller ve rapor sayfaları', 'Visuals and report pages'], 3, 5, 8, 'I', 'BI ekibi', 'Geliştirme'],
        ['K', ['Lisans ve çalışma alanı', 'Licences and workspace'], 1, 2, 8, 'A', 'BT', 'Altyapı', 6],
        ['L', ['Satır düzeyi güvenlik (RLS)', 'Row-level security (RLS)'], 2, 3, 6, 'K,H', 'BT', 'Altyapı'],
        ['M', ['Otomatik yenileme (ağ geçidi)', 'Scheduled refresh (gateway)'], 1, 2, 5, 'K,D', 'BT', 'Altyapı'],
        ['N', ['Kullanıcı kabul testi', 'User acceptance testing'], 3, 4, 7, 'J,L,M,E', 'Analiz ekibi', 'Test'],
        ['O', ['Vardiya amirleri eğitimi', 'Shift supervisor training'], 2, 2, 4, 'N', 'Eğitim', 'Eğitim'],
        ['P', ['Canlıya geçiş', 'Go-live'], 1, 1, 2, 'O', 'BT', 'Altyapı'],
        ['Q', ['İlk ay izleme ve düzeltmeler', 'First-month monitoring and fixes'], 5, 5, 8, 'P', 'BI ekibi', 'Geliştirme'],
      ], dil),
    }),
  ];
}
