# Sunucuya kurulum (ysfdurak.com ortak altyapısı)

Web arayüzü tek başına tarayıcıda çalışır (hesap Web Worker'da). Sunucu, MCP kapısı (Claude bağlantısı)
sürekli açık olsun diye gerekir; bu yüzden VPS'te, diğer projelerle aynı ortak altyapıda
(Caddy + `web` ağı) çalışır. Uygulama portu dışarı açılmaz; dışarıya yalnız Caddy açar.
Sunucu **veri saklamaz**: veritabanı, birim ve yedek yoktur.

## 1. Cloudflare
`termin` için sunucunun IP'sine **A kaydı**, proxy açık (turuncu bulut). 80/443 yalnız Cloudflare'den
kabul edildiği için (`sunucu/cloudflare-kaynak.sh`) gri bulutta site açılmaz.

## 2. Kurulum betiği
```bash
ssh yusuf@SUNUCU
cd ~/ysfdurak.com && git pull
bash sunucu/kurulum-termin.sh
```
Betik: kodu `~/termin-olasiligi` klasörüne alır, `.env`'i örnekten oluşturur (gizli anahtar yok),
`deploy/docker-compose.ortak.yml` ile derleyip başlatır, sağlık denetimini bekler ve Caddy'yi
yeniden başlatır. Tekrar çalıştırmak güvenlidir (güncelleme de budur).

Ölçüm servisine yeni proje eklendiği için ayrıca: `bash ~/ysfdurak.com/sunucu/kurulum-olcum.sh`.

## 3. Kontrol
- https://termin.ysfdurak.com açılıyor; tarayıcı konsolunda CSP uyarısı yok.
- `curl -sI https://termin.ysfdurak.com | grep -i content-security` başlığı gösteriyor.
- `curl -s https://termin.ysfdurak.com/healthz` → `{"durum":"ok"}`.
- Claude'da özel bağlayıcı (Ayarlar → Bağlayıcılar → Özel bağlayıcı ekle):
  - URL: `https://termin.ysfdurak.com/mcp`
  - Kimlik doğrulama: "Oturum açma yok" (araçların hepsi salt okunur; sunucu veri saklamaz)
  - Dene: "Termin Olasılığı'ndaki yöntem örneği 30 gün içinde biter mi?" → olasılık eğrisi açılmalı.
- `sudo docker stats termin --no-stream`: bellek 100 MB'ın altında olmalı.

## Notlar
- Sınırlar: MCP IP başına dakikada 60 istek, en çok 20.000 tur; sayfa IP başına dakikada 600 istek;
  istek gövdesi 512 KB. `.env` ile değiştirilebilir.
- MCP'yi kapatmak için `.env`'de `MCP_ACIK=0`, sonra betiği yeniden çalıştır.
- Tek başına (ortak altyapı olmadan) kurulum: kök klasördeki `docker-compose.yml`, önüne kendi ters
  vekilin (HTTPS). Kurum içi kurulumda ölçüm yükleyicisi çalışmaz (yalnız termin.ysfdurak.com'da yüklenir).
