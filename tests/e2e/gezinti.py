"""Tarayıcı duman testi (Playwright, Python). Sunucuyu kendisi başlatır: python3 tests/e2e/gezinti.py
Önce: npm run build. Denetlenenler: CSP ihlali ve konsol hatası yok, üç örnek hesaplanıyor, sekmeler, EN,
CSV ve .xlsx şablon içe aktarma, kötü niyetli yedeğin reddi, kayıttaki betikli değerin çalışmaması, telefon görünümü."""
import json, os, socket, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright

KOK = Path(__file__).resolve().parents[2]
CIKTI = Path(os.environ.get('EKRAN_KLASORU', tempfile.mkdtemp(prefix='termin-ekran-')))
CIKTI.mkdir(parents=True, exist_ok=True)


def bos_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


PORT = bos_port()
B = f'http://127.0.0.1:{PORT}'
sunucu = subprocess.Popen(['node', 'server/index.ts'], cwd=KOK, env={**os.environ, 'PORT': str(PORT)}, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
for _ in range(50):
    try:
        socket.create_connection(('127.0.0.1', PORT), 0.2).close(); break
    except OSError:
        time.sleep(0.1)

hatalar = []
sayac = 0


def kontrol(kosul, ileti):
    global sayac
    sayac += 1
    if not kosul:
        hatalar.append(ileti)
        print('  HATA:', ileti)


def sayfa_ac(c):
    pg = c.new_page()
    pg.on('console', lambda m: m.type == 'error' and hatalar.append('konsol: ' + m.text))
    pg.on('pageerror', lambda e: hatalar.append('sayfa hatası: ' + str(e)))
    pg.on('dialog', lambda d: (hatalar.append('beklenmeyen pencere: ' + d.message), d.dismiss()))
    return pg


try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        c = b.new_context(viewport={'width': 1280, 'height': 900}, locale='tr-TR', accept_downloads=True)
        pg = sayfa_ac(c)
        pg.goto(B + '/')
        pg.wait_for_selector('.proje-kart')
        kontrol(pg.locator('.proje-kart').count() == 3, 'üç örnek kart')

        # Yöntem örneği: kapsam dokümanının sayıları ekranda
        pg.goto(B + '/#/p/ornek-yontem/sonuc')
        pg.wait_for_selector('.yuzdelik b')
        metin = pg.inner_text('.manset')
        kontrol('%18' in metin and '26,0 iş günü' in metin and '23,8' in metin, 'yöntem örneği sayıları: ' + metin[:200])
        kontrol(pg.locator('.riskli tbody tr').first.inner_text().startswith('D'), 'en riskli iş D')
        for sek in ['isler', 'senaryo', 'nasil']:
            pg.click(f'.sekmeler a[href$="/{sek}"]')
            pg.wait_for_timeout(400)
        pg.click('.sekmeler a[href$="/senaryo"]')
        kontrol(pg.is_disabled('text=Senaryoyu dene'), 'değişiklik yokken senaryo düğmesi kapalı')
        alanlar = pg.locator('.senaryo-satir input')
        alanlar.nth(0).fill('6'); alanlar.nth(1).fill('8'); alanlar.nth(2).fill('12')
        pg.click('text=Senaryoyu dene')
        pg.wait_for_selector('.kiyas-tablo')
        kontrol('erken' in pg.inner_text('.kiyas-tablo'), 'senaryo öne çekiyor')
        pg.screenshot(path=str(CIKTI / 'senaryo.png'), full_page=True)

        # İşler: hatalı tahmin → hata iletisi, düzeltince kalkar
        pg.goto(B + '/#/p/ornek-yontem/isler')
        ilk = pg.locator('tbody tr').first.locator('input').nth(2)
        ilk.fill('9')
        pg.wait_for_selector('.bulgular li.hata')
        kontrol('iyimser ≤ olası ≤ kötümser' in pg.inner_text('.bulgular'), 'sıra hatası iletisi')
        kontrol('(1!)' in pg.inner_text('.sekmeler'), 'sekmede hata sayısı')
        ilk.fill('2')
        pg.wait_for_selector('.ileti.tamam')
        pg.goto(B + '/')
        kontrol(pg.locator('.rozet.soluk').count() == 1, 'değişen örnek işareti')
        pg.click('text=Örneği ilk hâline döndür')
        kontrol(pg.locator('.rozet.soluk').count() == 0, 'örnek sıfırlandı')

        # CSV içe aktarma
        csv = tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False, encoding='utf-8')
        csv.write('İş kodu;İş adı;İyimser;Olası;Kötümser;Öncüller\nA;Analiz;2;3;6;\nB;Kurulum;3;5;10;A\n'); csv.close()
        pg.set_input_files('input[accept=".xlsx,.csv,.txt"]', csv.name)
        pg.wait_for_selector('.aktarma')
        pg.click('text=Projeyi oluştur')
        pg.wait_for_selector('.yuzdelik b')
        kontrol('/#/p/p-' in pg.url, 'CSV projesi açıldı')

        # Şablon (.xlsx) indir → geri yükle
        pg.goto(B + '/')
        with pg.expect_download() as d:
            pg.click('text=Şablonu indir (.xlsx)')
        yol = d.value.path()
        pg.set_input_files('input[accept=".xlsx,.csv,.txt"]', yol)
        pg.wait_for_selector('.aktarma')
        kontrol('5 iş' in pg.inner_text('.aktarma'), 'şablon xlsx geri okundu')
        pg.click('text=Projeyi oluştur')
        pg.wait_for_selector('.yuzdelik b')
        with pg.expect_download() as d:
            pg.click('text=Excel (.xlsx)')
        kontrol(d.value.suggested_filename.endswith('.xlsx'), 'sonuç Excel indirildi')

        # Kötü niyetli yedek reddedilir
        kotu = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False)
        json.dump({'projeler': [{'id': 'x', 'ad': '<img src=x onerror=alert(1)>', 'baslangic': '2026-12-01', 'isler': []}]}, kotu); kotu.close()
        pg.goto(B + '/')
        pg.set_input_files('input[accept=".json,application/json"]', kotu.name)
        pg.wait_for_selector('.ileti.hata')
        kontrol('geçersiz' in pg.inner_text('.ileti.hata'), 'kötü yedek reddi')

        # Kayıttaki betikli değer çalışmaz (React kaçışlar); öznitelik ve metin
        zehir = '"><img src=x onerror="window.__zehir=1">'
        pg.evaluate("""z => localStorage.setItem('termin.v1', JSON.stringify({surum:1, ornekDegisiklik:{}, projeler:[{id:'p-zehir', ad:z, baslangic:'2026-12-01',
          isler:[{kod:'A', ad:z, iyimser:1, olasi:2, kotumser:3, onculler:[], sorumlu:z, kategori:z}]}]}))""", zehir)
        for adres in ['/', '/#/p/p-zehir/sonuc', '/#/p/p-zehir/isler', '/#/p/p-zehir/nasil']:
            pg.goto(B + adres)
            pg.wait_for_timeout(700)
        kontrol(pg.evaluate('window.__zehir') is None, 'kayıttaki betik çalışmadı')

        # İngilizce
        pg.goto(B + '/?dil=en#/p/ornek-iade/sonuc')
        pg.wait_for_selector('.yuzdelik b')
        kontrol('85% chance' in pg.inner_text('.manset').lower() and pg.input_value('.proje-adi') == 'Returns process redesign', 'İngilizce arayüz ve örnek')
        pg.screenshot(path=str(CIKTI / 'en-sonuc.png'), full_page=True)
        c.close()

        # Telefon
        c = b.new_context(viewport={'width': 390, 'height': 844}, locale='tr-TR', is_mobile=True, has_touch=True)
        pg = sayfa_ac(c)
        pg.goto(B + '/#/p/ornek-panel/sonuc')
        pg.wait_for_selector('.yuzdelik b')
        genislik = pg.evaluate('document.documentElement.scrollWidth')
        kontrol(genislik <= 392, f'telefonda yatay taşma yok ({genislik})')
        pg.screenshot(path=str(CIKTI / 'tel-panel.png'), full_page=True)
        c.close()
        b.close()
finally:
    sunucu.terminate()

print(f'{sayac} kontrol, {len(hatalar)} hata. Ekranlar: {CIKTI}')
for h in hatalar:
    print(' -', h)
sys.exit(1 if hatalar else 0)
