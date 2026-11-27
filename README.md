# Termin Olasılığı

**Tek tarih değil, olasılık.** Termin Olasılığı bir projenin bitiş tarihini olasılıkla verir:
"%50 ihtimalle 28 Ocak, %85 ihtimalle 2 Şubat". Söz verilen tarihin tutma olasılığını ve termini en
çok hangi işin oynattığını da gösterir. Her işin iyimser, olası ve kötümser tahminini alır, projeyi
Monte Carlo yöntemiyle binlerce kez simüle eder.

Canlı demo: https://termin.ysfdurak.com · English: *Deadline Odds* (arayüz TR/EN)

## Neden

Planlar çoğu zaman en olası süreler toplanarak yapılır. Bu yöntem iki hata yapar: belirsizliği yok
sayar ve paralel işlerin birleştiği noktalarda gecikmeyi sistematik olarak düşük gösterir (birleşme
yanlılığı). Uygulamadaki 5 işlik yöntem örneğinde en olası sürelerle yapılan plan 22 gün çıkar ve
**yalnızca %18 ihtimalle tutar**. %85 güvenli bitiş 26,0 gündür. Klasik PERT ise 25,4 der, çünkü tek
kritik yola bakar.

## Ne yapar

| Ekran | Ne gösterir |
| --- | --- |
| Projeler | Üç hazır örnek (Yıldız Ev & Yaşam, kurgusal), kendi projelerin, Excel/CSV yükleme, şablon, yedek |
| Sonuç | Plan tarihinin tutma olasılığı, %50/%85/%95 tarihleri, olasılık eğrisi, termini en çok oynatan işler (duyarlılık ve kritiklik), klasik hesaplarla kıyas, biten işlerde tahmin sapması, Excel/CSV/PDF |
| İşler | Biten işe gerçek süre, sürmekte olan projede veri tarihi (bitmemiş iş geçmişte başlayamaz); tabloda düzenleme, anlık doğrulama (sıra, döngü, bilinmeyen öncül, kopuk iş, aynı sorumluya çakışan işler), iş ağı çizimi |
| Senaryo | Bir ya da birkaç işin tahminini değiştir; iki hesap aynı rastgele sayılarla yapılır, fark yalnız değişiklikten gelir |
| Nasıl hesaplandı? | PERT formülü bu projenin sayılarıyla, simülasyonun ilk turu (çekilen süreler, başlama/bitiş, kritik yol), sınırlar |

**Excel/CSV:** Zorunlu sütunlar iş adı ve üç tahmin. Türkçe ve İngilizce başlıklar tanınır. Pusula'nın
Excel dışa aktarması da okunur (İş, Durum, Sorumlular, Başlangıç, Tamamlanma); üç tahmin sütununu
eklemek yeter, biten işlerin gerçek süresi tarihlerden hesaplanır. Dosya tarayıcıda okunur, sunucuya
gitmez; projeler yalnızca o tarayıcıda (localStorage) saklanır.

## Claude'dan kullanma (MCP)

Aynı çekirdek bir MCP sunucusu olarak da çalışır: `https://termin.ysfdurak.com/mcp` (oturum açma yok).

| Araç | Örnek soru |
| --- | --- |
| `ornek_projeler` | "Hangi örnek projeler var?" |
| `proje_yukle` | "Şu iş listesinden proje oluştur" (CSV metni ya da iş listesi) |
| `bitis_olasiligi` | "Bu proje 30 Mart'a yetişir mi?" (destekleyen istemcide etkileşimli eğri açılır) |
| `en_riskli_isler` | "Termini en çok ne oynatıyor?" |
| `senaryo_dene` | "Geliştirmeye bir kişi eklesek ne olur?" |
| `is_tahmini_guncelle` | "Tasarım 7 günde bitti, güncelle" |

Sunucu durumsuzdur: araçlar ya hazır örnek kimliği ya da proje nesnesi alır; yazan araçlar projeyi
kaydetmez, güncel nesneyi döner. Bütün araçlar salt okunurdur.

## Mimari

```
src/cekirdek/   TypeScript, bağımlılıksız: PERT, tohumlu rastgele sayı, ağ, Monte Carlo, senaryo, içe aktarma
src/web/        React + Vite arayüzü; hesap Web Worker'da (sim.worker.js), aynı çekirdekle
src/mcp-app/    Claude içinde açılan olasılık eğrisi (tek HTML dosyası)
server/         Node HTTP: dist/ dosyaları, /mcp (resmî MCP SDK), /healthz. TypeScript'i derlemeden çalıştırır
```

Web ve MCP aynı çekirdeği aynı tohumla çağırır, bu yüzden aynı projede aynı sonucu verir.

## Çalıştırma

```bash
npm ci
npm run build          # dist/ ve dist-mcp-app/
npm start              # http://127.0.0.1:8080  (Node 22.18+)
npm run dev            # yalnız arayüz, Vite geliştirme sunucusu
npm test               # çekirdek doğruluk testleri + sunucu/MCP testleri (önce build)
npm run test:e2e       # tarayıcı duman testi (Python Playwright)
npm run typecheck
```

Docker: `cp .env.example .env && docker compose up -d --build`. ysfdurak.com sunucusunda:
[deploy/KURULUM.md](deploy/KURULUM.md).

## Doğruluk

`tests/cekirdek.test.ts`, kapsam dokümanındaki elle çözülmüş örneği bağımsız bir 200.000 turluk
Python simülasyonuyla karşılaştırır (±0,2 gün): %50 23,8 · %85 26,0 · %95 27,3; plan %18; kritiklik
B %36, C %64; duyarlılık D 0,71. Senaryo (D 6/8/12) %85'i 23,4'e çeker. Hepsi tutuyor.

## Sınırlar

Sonuç girilen tahminler kadar iyidir. İşler bağımsız varsayılır; kaynak kısıtı yoktur (aynı sorumluya
çakışan işler uyarı verir); takvim yalnız hafta sonlarını atlar. Biten işlerdeki tahmin sapması
gösterilir ama tahminler henüz düzeltilmez: kalibrasyon V2'de, Domino görünümü V3'te.

## Güvenlik

Portföyün ortak güvenlik temeline göre kuruldu (ysfdurak.com → `docs/GUVENLIK_TEMELI.md`).

- **Tarayıcı:** Satır içi betik yok; CSP `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`;
  nosniff, HSTS, Referrer-Policy, Permissions-Policy, X-Frame-Options, COOP. Dış CDN ve yazı tipi yok.
  Ekrana giden her değer React tarafından kaçışlanır (`innerHTML` yok).
- **İçe aktarma:** Dosya boyutu okunmadan önce sınırlı (5 MB); .xlsx açılırken açılmış boyut (40 MB) ve
  parça sayısı sayılarak sınırlanır. Değerler tür, uzunluk ve aralık denetiminden geçer; en çok 500 iş.
  Etkin HTML içeren yedek reddedilir. CSV dışa aktarımında formül enjeksiyonu önlenir.
- **Sunucu:** Dizin gezme yok, gövde sınırı (413), IP başına hız sınırı (429; IP yalnız özel ağdaki
  vekilden), tarayıcıdan gelen MCP isteğinde Origin denetimi, beklenmeyen hatada genel ileti.
  MCP'de tur sayısı en çok 20.000.
- **Konteyner:** root olmayan kullanıcı, `read_only`, `cap_drop: ALL`, `no-new-privileges`,
  bellek/süreç/kayıt sınırı, port açmadan ortak `web` ağı.
- **Ölçüm:** Yalnız resmî demo adresinde anonim ekran ve işlem adları (ortak ölçüm servisi);
  proje ve iş adları, tahminler, dosyalar gönderilmez. Kurum kurulumunda ölçüm yoktur.

## Lisans

Bu proje [PolyForm Shield 1.0.0](LICENSE.md) lisansıyla yayınlanır. Kaynak kodu açıktır, ancak resmi anlamda bir "açık kaynak" lisansı değildir.

- **Serbest:** Kişiler, okullar ve şirketler kendi işlerinde ücretsiz kullanabilir, değiştirebilir ve kendi bilgisayarlarına ya da sunucularına kurabilir. İzin almak gerekmez.
- **Yazılı izin gerekir:** Yazılımı satmak, adını değiştirip ürün gibi sunmak ya da bununla (ücretsiz olsa bile) rakip bir ürün veya hizmet sunmak.
- **Garanti yok:** Yazılım olduğu gibi sunulur. Bağlayıcı olan İngilizce lisans metnidir.
- Üçüncü taraf bileşenler kendi lisanslarına tabidir.
- Örnek projeler (Yıldız Ev & Yaşam) kurgudur ve aynı lisansla kullanılır.

Kurumunuzda kullanıyorsanız haber verirseniz sevinirim: kurulumda yardımcı olabilir, kurumunuza özel ihtiyaçları birlikte değerlendirebiliriz. Kurum içi kurulum: `docker compose up -d --build` (yukarıda, "Çalıştırma"); projeler kullanıcıların tarayıcısında kalır, sunucu veri saklamaz ve dışarıya istek atmaz. İletişim: iletisim@ysfdurak.com

### License (English)

Released under [PolyForm Shield 1.0.0](LICENSE.md). The source is available, but this is not an OSI "open source" licence.

- **Free:** individuals, schools and companies may use it in their own work, change it and run it on their own computers or servers. No permission needed.
- **Needs written permission:** selling it, rebranding it as a product, or providing a product or service that competes with it (even free of charge).
- **No warranty:** provided as is. The English licence text is binding.
- Third-party components keep their own licences.
- The sample projects (Yıldız Ev & Yaşam) are fictional and covered by the same licence.

Using it in your organisation? I'd be glad to hear from you: I can help with setup and look at your organisation's needs together. In-house setup: `docker compose up -d --build`; projects stay in users' browsers, the server stores nothing and makes no outbound requests. Contact: contact@ysfdurak.com
