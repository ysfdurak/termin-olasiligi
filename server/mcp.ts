// MCP kapısı: web arayüzünün kullandığı çekirdeği Claude'a araç olarak açar.
// Sunucu durumsuzdur ve veri saklamaz: araçlar ya hazır örnek kimliği (ornek) ya da proje nesnesi (proje) alır.
// proje_yukle ve is_tahmini_guncelle projeyi KAYDETMEZ; güncel proje nesnesini döner, Claude onu sonraki araca verir.
// Kayıtlı projeler (giriş gerektirir) kapsam dokümanında V2'ye bırakıldı.
import { McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  bitisTarihi, bulguMetni, bugun, csvOku, dogrula, hataVar, ilkIsGunu, isGunuSay, ornekProjeler, satirlardanProje, senaryoDene, simuleEt, tahminSapmasi, SINIR,
} from '../src/cekirdek/index.ts';
import type { Proje, Sonuc } from '../src/cekirdek/index.ts';

export const MCP_TUR_SINIRI = 20000;
const URI = 'ui://termin/egri.html';
const OKU = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const tarihSema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-AA-GG biçiminde olmalı');
const isSema = z.object({
  kod: z.string().min(1).max(20),
  ad: z.string().min(1).max(SINIR.adUzunluk),
  iyimser: z.number().min(0).max(SINIR.sure),
  olasi: z.number().min(0).max(SINIR.sure),
  kotumser: z.number().min(0).max(SINIR.sure),
  onculler: z.array(z.string().max(20)).max(SINIR.oncul).optional().describe('Önce bitmesi gereken işlerin kodları'),
  sorumlu: z.string().max(80).optional(),
  kategori: z.string().max(60).optional(),
  durum: z.enum(['bekliyor', 'devam', 'bitti']).optional(),
  gerceklesen: z.number().min(0).max(SINIR.sure).optional().describe('Biten işin gerçek süresi (iş günü)'),
});
const projeSema = z.object({
  id: z.string().max(40).optional(),
  ad: z.string().max(120),
  baslangic: tarihSema.describe('İlk iş günü'),
  planTarihi: tarihSema.optional().describe('Söz verilen bitiş tarihi'),
  durumTarihi: tarihSema.optional().describe('Sürmekte olan projede veri tarihi (bugün): bitmemiş işler bu tarihten önce başlayamaz'),
  isler: z.array(isSema).min(1).max(SINIR.is),
});
const kaynak = {
  ornek: z.enum(['ornek-yontem', 'ornek-iade', 'ornek-panel']).optional().describe('Hazır örnek projenin kimliği (ornek_projeler aracından)'),
  proje: projeSema.optional().describe('Kendi proje nesnesi (proje_yukle aracının döndürdüğü biçim)'),
  dil: z.enum(['tr', 'en']).optional().describe('Örnek proje ve uyarı metinlerinin dili'),
};
const turSema = z.number().int().min(1000).max(MCP_TUR_SINIRI).optional().describe(`Tur sayısı (varsayılan 10.000, en çok ${MCP_TUR_SINIRI})`);

class KullaniciHatasi extends Error {}

type Kaynak = { ornek?: string; proje?: z.infer<typeof projeSema>; dil?: 'tr' | 'en' };

function projeAl(a: Kaynak): Proje {
  if (a.ornek && a.proje) throw new KullaniciHatasi('Ya "ornek" ya da "proje" verin, ikisini birden değil.');
  if (a.ornek) {
    const p = ornekProjeler(bugun(), a.dil || 'tr').find((x) => x.id === a.ornek);
    if (!p) throw new KullaniciHatasi('Böyle bir örnek proje yok.');
    return p;
  }
  if (!a.proje) throw new KullaniciHatasi('"ornek" ya da "proje" gerekli. Hazır örnekler için ornek_projeler aracını çağırın.');
  const p: Proje = {
    id: a.proje.id || 'mcp-' + a.proje.ad.slice(0, 20),
    ad: a.proje.ad,
    baslangic: a.proje.baslangic,
    isler: a.proje.isler.map((is) => ({ ...is, onculler: is.onculler || [] })),
  };
  if (a.proje.planTarihi) p.planTarihi = a.proje.planTarihi;
  if (a.proje.durumTarihi) p.durumTarihi = a.proje.durumTarihi;
  return p;
}

function hesapla(p: Proje, dil: 'tr' | 'en', tur?: number, hedef?: string): Sonuc {
  const b = dogrula(p);
  if (hataVar(b)) throw new KullaniciHatasi('Proje hatalı:\n- ' + b.filter((x) => x.seviye === 'hata').map((x) => bulguMetni(x, dil)).join('\n- '));
  return simuleEt(p, { tur: tur ?? 10000, hedefGun: hedef ? isGunuSay(p.baslangic, hedef) : undefined });
}

const yuvarla = (x: number, b = 1) => Math.round(x * 10 ** b) / 10 ** b;

function tarihli(p: Proje, gun: number) {
  return { gun: yuvarla(gun), tarih: bitisTarihi(p.baslangic, gun) };
}

function ozet(p: Proje, s: Sonuc, dil: 'tr' | 'en') {
  const uyarilar = dogrula(p).filter((x) => x.seviye === 'uyari').map((x) => bulguMetni(x, dil));
  const o: Record<string, unknown> = {
    proje: { ad: p.ad, baslangic: p.baslangic, planTarihi: p.planTarihi ?? null, durumTarihi: p.durumTarihi ?? null, isSayisi: p.isler.length },
    birim: 'iş günü (hafta sonları sayılmaz)',
    p50: tarihli(p, s.p50),
    p85: tarihli(p, s.p85),
    p95: tarihli(p, s.p95),
    enOlasiSurelerlePlan: tarihli(p, s.deterministik),
    klasikPert85: tarihli(p, s.pert.p85),
    planTutmaOlasiligi: s.plan ? yuvarla(s.plan.olasilik, 3) : null,
    planGun: s.plan ? s.plan.gun : null,
    tur: s.tur,
    tohum: s.tohum,
  };
  if (s.hedef) o.hedef = { tarih: bitisTarihi(p.baslangic, Math.max(1, s.hedef.gun)), gun: s.hedef.gun, olasilik: yuvarla(s.hedef.olasilik, 3) };
  if (uyarilar.length) o.uyarilar = uyarilar;
  const sap = tahminSapmasi(p);
  if (sap.toplam) o.bitenIslerdeSapma = { adet: sap.toplam.adet, gerceklesenBoluOlasi: yuvarla(sap.toplam.oran, 2), not: 'Yalnız gösterilir; kalibrasyon V2' };
  return o;
}

function riskliler(p: Proje, s: Sonuc, adet: number) {
  const ad = Object.fromEntries(p.isler.map((i) => [i.kod, i.ad]));
  return [...s.isler]
    .sort((a, b) => b.duyarlilik - a.duyarlilik || b.kritiklik - a.kritiklik)
    .slice(0, adet)
    .map((x) => ({ kod: x.kod, ad: ad[x.kod], duyarlilik: yuvarla(x.duyarlilik, 2), kritiklik: yuvarla(x.kritiklik, 2), ortalamaSure: yuvarla(x.ortalama), sabit: x.sabit }));
}

function metin(o: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }] };
}

export function mcpIsleyici({ grafikHtml, kayit }: { grafikHtml: string | null; kayit: (m: string) => void }) {
  function sar<T>(ad: string, f: (a: T) => any) {
    return async (a: T) => {
      try {
        return await f(a);
      } catch (e) {
        if (e instanceof KullaniciHatasi) return { isError: true, content: [{ type: 'text' as const, text: e.message }] };
        kayit(`MCP hatası (${ad}): ${(e as Error)?.stack || e}`);
        return { isError: true, content: [{ type: 'text' as const, text: 'İstek işlenemedi.' }] };
      }
    };
  }

  function sunucuKur() {
    const s = new McpServer(
      { name: 'termin-olasiligi', version: '0.1.0' },
      {
        instructions:
          'Termin Olasılığı, projenin bitiş tarihini Monte Carlo simülasyonuyla olasılık olarak verir. Süreler iş günüdür (hafta sonu sayılmaz). ' +
          'Sunucu veri saklamaz: araçlara ya hazır örnek kimliği (ornek) ya da proje nesnesi (proje) verilir; proje_yukle ve is_tahmini_guncelle güncel proje nesnesini döner, sonraki çağrıda onu kullan. ' +
          'Sonucu kullanıcıya tek tarih olarak değil olasılıkla anlat (%50, %85, %95). Sonuç girilen tahminler kadar iyidir; kaynak kısıtı ve tatiller hesaba katılmaz.',
      },
    );

    s.registerTool(
      'ornek_projeler',
      { description: 'Hazır örnek projeleri listeler (kimlik, ad, iş sayısı, başlangıç ve plan tarihi). Kullanıcının kendi projesi yoksa buradan başla.', inputSchema: z.object({ dil: kaynak.dil }), annotations: OKU },
      sar('ornek_projeler', (a: { dil?: 'tr' | 'en' }) =>
        metin(ornekProjeler(bugun(), a.dil || 'tr').map((p) => ({ ornek: p.id, ad: p.ad, aciklama: p.aciklama, isSayisi: p.isler.length, baslangic: p.baslangic, planTarihi: p.planTarihi }))),
      ),
    );

    s.registerTool(
      'proje_yukle',
      {
        description:
          'Excel/CSV metninden (ilk satır başlık; is_kodu, is_adi, iyimser_gun, olasi_gun, kotumser_gun, onculler…; Türkçe/İngilizce başlıklar ve Pusula dışa aktarması tanınır) ya da iş listesinden proje oluşturur ve doğrular. Projeyi kaydetmez; dönen "proje" nesnesini diğer araçlara ver.',
        inputSchema: z.object({
          ad: z.string().min(1).max(120),
          baslangic: tarihSema.optional().describe('Verilmezse bugünden sonraki ilk iş günü'),
          planTarihi: tarihSema.optional(),
          csv: z.string().max(200000).optional().describe('CSV/TSV metni (; , ya da sekme ile ayrılmış)'),
          isler: z.array(isSema).max(SINIR.is).optional(),
          dil: kaynak.dil,
        }),
        annotations: OKU,
      },
      sar('proje_yukle', (a: { ad: string; baslangic?: string; planTarihi?: string; csv?: string; isler?: z.infer<typeof isSema>[]; dil?: 'tr' | 'en' }) => {
        if (!!a.csv === !!a.isler) throw new KullaniciHatasi('"csv" ya da "isler" alanlarından tam olarak biri verilmeli.');
        const ust = { id: 'mcp-' + a.ad.slice(0, 20).replace(/[^a-z0-9]+/gi, '-').toLowerCase(), ad: a.ad, baslangic: a.baslangic || ilkIsGunu(bugun()), planTarihi: a.planTarihi };
        let proje: Proje;
        const notlar: string[] = [];
        if (a.csv) {
          const r = satirlardanProje(csvOku(a.csv), ust);
          if (r.eksik.length) throw new KullaniciHatasi(`Zorunlu sütun bulunamadı: ${r.eksik.join(', ')}. Bulunan eşleşmeler: ${JSON.stringify(r.eslesen)}`);
          proje = r.proje;
          if (r.otomatikKod) notlar.push('Kod sütunu yok; satır numarası kod olarak kullanıldı.');
          if (r.tarihtenHesaplanan) notlar.push(`${r.tarihtenHesaplanan} biten işin süresi tarihlerden hesaplandı.`);
          if (r.atlanan.bos + r.atlanan.iptal) notlar.push(`${r.atlanan.bos + r.atlanan.iptal} boş/iptal satır atlandı.`);
        } else {
          proje = { ...ust, isler: a.isler!.map((is) => ({ ...is, onculler: is.onculler || [] })) };
          if (!a.planTarihi) delete proje.planTarihi;
        }
        const bulgular = dogrula(proje);
        return metin({
          gecerli: !hataVar(bulgular),
          hatalar: bulgular.filter((b) => b.seviye === 'hata').map((b) => bulguMetni(b, a.dil || 'tr')),
          uyarilar: bulgular.filter((b) => b.seviye === 'uyari').map((b) => bulguMetni(b, a.dil || 'tr')),
          notlar,
          proje,
        });
      }),
    );

    registerAppTool(
      s,
      'bitis_olasiligi',
      {
        title: 'Bitiş olasılığı',
        description:
          'Projenin %50/%85/%95 bitiş tarihlerini, plan tarihinin tutma olasılığını ve isteğe bağlı bir tarihe yetişme olasılığını verir. Destekleyen istemcide olasılık eğrisini etkileşimli grafik olarak gösterir. "Ne zaman biter?", "30 Mart\'a yetişir mi?" soruları için.',
        inputSchema: z.object({ ...kaynak, tarih: tarihSema.optional().describe('Yetişme olasılığı sorulan tarih'), tur: turSema }),
        annotations: OKU,
        _meta: { ui: { resourceUri: URI } },
      },
      sar('bitis_olasiligi', (a: Kaynak & { tarih?: string; tur?: number }) => {
        const dil = a.dil || 'tr';
        const p = projeAl(a);
        const s = hesapla(p, dil, a.tur, a.tarih);
        const o = ozet(p, s, dil);
        if (a.tarih && o.hedef) (o.hedef as Record<string, unknown>).tarih = a.tarih;
        return {
          structuredContent: { ...o, dil, egri: s.egri.map(([g, q]) => [yuvarla(g, 2), q]), histogram: s.histogram.map(([x, y, n]) => [yuvarla(x, 3), yuvarla(y, 3), n]), riskli: riskliler(p, s, 3) },
          content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }],
        };
      }),
    );

    s.registerTool(
      'en_riskli_isler',
      {
        description: 'Termini en çok oynatan işleri sıralar: duyarlılık (iş süresi ile proje süresi korelasyonu) ve kritiklik (turların yüzde kaçında kritik yolda). "Termini ne oynatıyor?", "Nereye odaklanmalıyız?" için.',
        inputSchema: z.object({ ...kaynak, adet: z.number().int().min(1).max(50).optional().describe('Kaç iş (varsayılan 5)'), tur: turSema }),
        annotations: OKU,
      },
      sar('en_riskli_isler', (a: Kaynak & { adet?: number; tur?: number }) => {
        const p = projeAl(a);
        const s = hesapla(p, a.dil || 'tr', a.tur);
        return metin({ proje: p.ad, p85: tarihli(p, s.p85), isler: riskliler(p, s, a.adet ?? 5) });
      }),
    );

    s.registerTool(
      'senaryo_dene',
      {
        description: 'Bir ya da birkaç bitmemiş işin üç tahmini değişirse sonucun nasıl değiştiğini gösterir (iki hesap aynı rastgele sayılarla yapılır). "Geliştirmeye bir kişi eklesek ne olur?" için: ilgili işin tahminlerini düşür.',
        inputSchema: z.object({
          ...kaynak,
          degisiklikler: z.array(z.object({ kod: z.string().max(20), iyimser: z.number().min(0).max(SINIR.sure), olasi: z.number().min(0).max(SINIR.sure), kotumser: z.number().min(0).max(SINIR.sure) })).min(1).max(20),
          tur: turSema,
        }),
        annotations: OKU,
      },
      sar('senaryo_dene', (a: Kaynak & { degisiklikler: { kod: string; iyimser: number; olasi: number; kotumser: number }[]; tur?: number }) => {
        const dil = a.dil || 'tr';
        const p = projeAl(a);
        hesapla(p, dil, 1000);
        let r;
        try {
          r = senaryoDene(p, a.degisiklikler, { tur: a.tur ?? 10000 });
        } catch (e) {
          throw new KullaniciHatasi((e as Error).message);
        }
        const fark = (x: number) => yuvarla(x);
        return metin({
          once: ozet(p, r.once, dil),
          sonra: ozet(r.proje, r.sonra, dil),
          farkIsGunu: { p50: fark(r.fark.p50), p85: fark(r.fark.p85), p95: fark(r.fark.p95) },
          planOlasiligiFarki: r.fark.plan !== undefined ? yuvarla(r.fark.plan, 3) : null,
        });
      }),
    );

    s.registerTool(
      'is_tahmini_guncelle',
      {
        description: 'Bir işin tahminini değiştirir ya da işi bitti olarak işaretleyip gerçek süresini girer, güncel sonucu hesaplar. Kaydetmez: dönen "proje" nesnesini sonraki çağrılarda kullan. "Tasarım 7 günde bitti, güncelle" için.',
        inputSchema: z.object({
          ...kaynak,
          kod: z.string().max(20),
          iyimser: z.number().min(0).max(SINIR.sure).optional(),
          olasi: z.number().min(0).max(SINIR.sure).optional(),
          kotumser: z.number().min(0).max(SINIR.sure).optional(),
          gerceklesen: z.number().min(0).max(SINIR.sure).optional().describe('Verilirse iş "bitti" sayılır'),
        }),
        annotations: OKU,
      },
      sar('is_tahmini_guncelle', (a: Kaynak & { kod: string; iyimser?: number; olasi?: number; kotumser?: number; gerceklesen?: number }) => {
        const dil = a.dil || 'tr';
        const p = projeAl(a);
        const i = p.isler.findIndex((x) => x.kod === a.kod);
        if (i < 0) throw new KullaniciHatasi(`"${a.kod}" kodlu iş projede yok.`);
        const is = { ...p.isler[i] };
        for (const k of ['iyimser', 'olasi', 'kotumser'] as const) if (a[k] !== undefined) is[k] = a[k] as number;
        if (a.gerceklesen !== undefined) {
          is.durum = 'bitti';
          is.gerceklesen = a.gerceklesen;
        }
        const yeni: Proje = { ...p, id: p.id.startsWith('ornek-') ? 'mcp-' + p.id : p.id, isler: p.isler.map((x, j) => (j === i ? is : x)) };
        const once = hesapla(p, dil);
        const sonra = hesapla(yeni, dil);
        return metin({ guncellenenIs: is, onceP85: tarihli(p, once.p85), sonuc: ozet(yeni, sonra, dil), proje: yeni });
      }),
    );

    registerAppResource(s, 'Bitiş olasılığı eğrisi', URI, { description: 'Termin Olasılığı · olasılık eğrisi (etkileşimli)' }, async () => ({
      contents: [
        {
          uri: URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: grafikHtml || '<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif">Grafik bu sunucuda derlenmemiş (npm run build). Aynı bilgi metin olarak da döndü.</p>',
          // Sayfa dış kaynak yüklemez ve ağ isteği atmaz.
          _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true } },
        },
      ],
    }));
    return s;
  }

  /** Her istek için yeni sunucu (durumsuz): oturum kimliği yok, istekler arasında bellek tutulmaz. */
  async function isle(req: IncomingMessage, res: ServerResponse, govde: unknown) {
    const s = sunucuKur();
    const tasiyici = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      tasiyici.close();
      s.close();
    });
    await s.connect(tasiyici as any);
    await tasiyici.handleRequest(req as any, res as any, govde);
  }
  return { isle };
}
