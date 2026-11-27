// Çekirdeğin doğruluk testleri. Beklenen sayılar kapsam dokümanındaki elle çözülmüş örnekten
// (200.000 turluk bağımsız Python simülasyonu): %50 23,8 · %85 26,0 · %95 27,3; plan (22 gün) %18.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bitisTarihi, csvOku, csvYaz, dogrula, hataVar, isGunuSay, klasikPert, ornekProjeler, satirlardanProje, senaryoDene, simuleEt, tahminSapmasi,
} from '../src/cekirdek/index.ts';
import { pertCek, uretec, normalUretec, pertOrtalama } from '../src/cekirdek/rastgele.ts';
import type { Proje } from '../src/cekirdek/index.ts';

const BUGUN = '2026-11-27'; // cuma
const [YONTEM, IADE, PANEL] = ornekProjeler(BUGUN);
const yakin = (x: number, y: number, tol: number, ad: string) => assert.ok(Math.abs(x - y) <= tol, `${ad}: ${x.toFixed(3)} beklenen ${y} ± ${tol}`);

test('PERT ortalaması ve klasik PERT (elle hesap)', () => {
  assert.equal(pertOrtalama(2, 3, 6), 20 / 6);
  const k = klasikPert(YONTEM);
  assert.deepEqual(k.yol, ['A', 'C', 'D', 'E']);
  yakin(k.ortalama, 23.5, 1e-9, 'PERT ortalama');
  yakin(k.stdSapma, 1.83, 0.01, 'PERT sigma');
  yakin(k.p85, 25.4, 0.05, 'PERT %85');
});

test('PERT çekilişi aralıkta kalır ve ortalaması (a+4m+b)/6', () => {
  const r = uretec(42);
  const z = normalUretec(r);
  let t = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) {
    const x = pertCek(3, 5, 10, r, z);
    assert.ok(x >= 3 && x <= 10);
    t += x;
  }
  yakin(t / N, 5.5, 0.02, 'örnek ortalama');
});

test('Yöntem örneği: kapsam dokümanının sayıları (±0,2 gün)', () => {
  const s = simuleEt(YONTEM, { tur: 200000, tohum: 1 });
  assert.equal(s.deterministik, 22);
  yakin(s.p50, 23.8, 0.2, '%50');
  yakin(s.p85, 26.0, 0.2, '%85');
  yakin(s.p95, 27.3, 0.2, '%95');
  assert.equal(s.plan?.gun, 22);
  yakin(s.plan!.olasilik, 0.18, 0.01, 'plan olasılığı');
  const k = Object.fromEntries(s.isler.map((i) => [i.kod, i]));
  for (const x of ['A', 'D', 'E']) assert.equal(k[x].kritiklik, 1);
  yakin(k.B.kritiklik, 0.36, 0.01, 'B kritiklik');
  yakin(k.C.kritiklik, 0.64, 0.01, 'C kritiklik');
  yakin(k.D.duyarlilik, 0.71, 0.02, 'D duyarlılık');
  yakin(k.E.duyarlilik, 0.43, 0.02, 'E duyarlılık');
  // en çok oynatan D
  assert.equal([...s.isler].sort((a, b) => b.duyarlilik - a.duyarlilik)[0].kod, 'D');
});

test('Aynı tohum = aynı sonuç; varsayılan tohum proje kimliğinden', () => {
  const a = simuleEt(YONTEM, { tur: 5000 });
  const b = simuleEt(structuredClone(YONTEM), { tur: 5000 });
  assert.equal(a.p85, b.p85);
  assert.equal(a.tohum, b.tohum);
  const c = simuleEt({ ...YONTEM, id: 'baska' }, { tur: 5000 });
  assert.notEqual(a.tohum, c.tohum);
});

test('Tek tur elle kontrol: D, B ile C\'den uzun olanı bekler', () => {
  const s = simuleEt(YONTEM, { tur: 100 });
  const o = s.ornekTur;
  const beklenen = o.sureler.A + Math.max(o.sureler.B, o.sureler.C) + o.sureler.D + o.sureler.E;
  yakin(o.toplam, beklenen, 1e-9, 'tur toplamı');
  assert.equal(o.kritikYol[0], 'A');
  assert.equal(o.kritikYol.at(-1), 'E');
  assert.ok(o.kritikYol.includes(o.sureler.B >= o.sureler.C ? 'B' : 'C'));
});

test('Senaryo: D 6/8/12 olursa %85 yaklaşık 2,5 gün öne gelir', () => {
  const r = senaryoDene(YONTEM, [{ kod: 'D', iyimser: 6, olasi: 8, kotumser: 12 }], { tur: 100000 });
  yakin(r.sonra.p85, 23.4, 0.2, 'senaryo %85');
  yakin(r.fark.p85, -2.6, 0.25, 'fark');
  assert.equal(r.once.tohum, r.sonra.tohum);
  assert.throws(() => senaryoDene(YONTEM, [{ kod: 'Z', iyimser: 1, olasi: 2, kotumser: 3 }]), /yok/);
  assert.throws(() => senaryoDene(PANEL, [{ kod: 'A', iyimser: 1, olasi: 2, kotumser: 3 }]), /bitmiş/);
});

test('%30 iyimser ekip: tüm tahminler 1,3 ile çarpılınca %85 ≈ 33,8', () => {
  const p: Proje = { ...YONTEM, isler: YONTEM.isler.map((i) => ({ ...i, iyimser: i.iyimser * 1.3, olasi: i.olasi * 1.3, kotumser: i.kotumser * 1.3 })) };
  yakin(simuleEt(p, { tur: 100000 }).p85, 33.8, 0.25, 'kalibre %85');
});

test('Doğrulama kuralları', () => {
  const temel = (isler: Proje['isler']): Proje => ({ id: 't', ad: 't', baslangic: '2026-12-01', isler });
  const is = (kod: string, onc: string[] = [], a = 1, m = 2, b = 3) => ({ kod, ad: 'İş ' + kod, iyimser: a, olasi: m, kotumser: b, onculler: onc });
  const kodlar = (p: Proje) => dogrula(p).map((b) => b.kod);
  assert.deepEqual(kodlar(temel([])), ['bos_proje']);
  assert.ok(kodlar(temel([is('A', [], 3, 2, 1)])).includes('sira'));
  assert.ok(kodlar(temel([is('A', ['X'])])).includes('bilinmeyen_oncul'));
  assert.ok(kodlar(temel([is('A', ['A'])])).includes('kendine_oncul'));
  assert.ok(kodlar(temel([is('A'), is('A')])).includes('kod_tekrar'));
  assert.ok(kodlar(temel([is('A', ['C']), is('B', ['A']), is('C', ['B'])])).includes('dongu'));
  assert.ok(kodlar(temel([is('<img>')])).includes('kod_bicim'));
  assert.ok(kodlar(temel([is('A', [], 2, 2, 2)])).includes('tek_nokta'));
  assert.ok(kodlar(temel([is('A'), is('B', ['A']), is('C')])).includes('kopuk'));
  assert.ok(kodlar({ ...temel([is('A')]), planTarihi: '2026-11-01' }).includes('plan_once'));
  assert.ok(kodlar({ ...temel([is('A')]), baslangic: '2026-02-30' }).includes('tarih_bicim'));
  assert.ok(kodlar(temel([{ ...is('A'), iyimser: NaN }])).includes('sayi_degil'));
  assert.equal(hataVar(dogrula(YONTEM)), false);
  assert.equal(dogrula(IADE).length, 0);
  assert.deepEqual(dogrula(PANEL).map((b) => b.kod), ['cakisan_sorumlu']);
  assert.throws(() => simuleEt(temel([])));
});

test('İş günü takvimi', () => {
  assert.equal(bitisTarihi('2026-11-30', 1), '2026-11-30'); // pazartesi, 1 gün
  assert.equal(bitisTarihi('2026-11-30', 5), '2026-12-04');
  assert.equal(bitisTarihi('2026-11-30', 5.2), '2026-12-07'); // 6. iş günü
  assert.equal(bitisTarihi('2026-11-28', 1), '2026-11-30'); // cumartesi başlangıç → pazartesi
  assert.equal(isGunuSay('2026-11-30', '2026-12-04'), 5);
  assert.equal(isGunuSay('2026-11-30', '2026-12-31'), 24);
  assert.equal(isGunuSay('2026-11-30', '2026-11-29'), 0);
  for (const g of [1, 7, 22, 23.8, 60]) assert.equal(isGunuSay('2026-11-30', bitisTarihi('2026-11-30', g)), Math.ceil(g));
});

test('Örnek projeler: plan tarihi en olası planla aynı gün, biten işler plana girmez', () => {
  assert.equal(isGunuSay(YONTEM.baslangic, YONTEM.planTarihi!), 22);
  const s = simuleEt(PANEL);
  assert.ok(s.plan!.gun < s.deterministik, 'gerçekleşen süreler planı kaydırmış olmalı');
  const sap = tahminSapmasi(PANEL);
  assert.equal(sap.toplam!.adet, 6);
  assert.ok(sap.toplam!.oran > 1.3);
  assert.ok(sap.kategoriler.every((k) => !k.yeterli));
});

test('Veri tarihi: bitmemiş iş geçmişte başlayamaz, devam eden iş geçmişte bitemez', () => {
  const p: Proje = {
    id: 'v', ad: 'v', baslangic: '2026-11-02', durumTarihi: '2026-11-16', // 10 iş günü geçti
    isler: [
      { kod: 'A', ad: 'Bitti', iyimser: 2, olasi: 2, kotumser: 2, onculler: [], durum: 'bitti', gerceklesen: 3 },
      { kod: 'B', ad: 'Bekliyor', iyimser: 2, olasi: 2, kotumser: 2, onculler: ['A'] },
      { kod: 'C', ad: 'Devam', iyimser: 1, olasi: 1, kotumser: 1, onculler: ['A'], durum: 'devam' },
    ],
  };
  const s = simuleEt(p, { tur: 200 });
  assert.equal(s.gecenGun, 10);
  assert.equal(s.ornekTur.baslangic.B, 10); // A 3. günde bitti ama B bugünden önce başlayamaz
  assert.equal(s.ornekTur.bitis.C, 10); // C 4. günde bitebilirdi; hâlâ devam ediyor
  assert.equal(s.p50, 12);
  assert.deepEqual(s.ornekTur.kritikYol, ['B']); // gecikmenin sebebi A değil, veri tarihi
  const { durumTarihi: _d, ...eski } = p;
  assert.equal(simuleEt(eski, { tur: 200 }).p50, 5);
  assert.ok(dogrula({ ...p, durumTarihi: '2026-10-01' }).some((b) => b.kod === 'tarih_bicim'));
});

test('CSV içe aktarma: Türkçe başlıklar, ; ayırıcı, virgüllü ondalık, tırnak', () => {
  const csv = '﻿İş kodu;İş adı;İyimser (gün);Olası (gün);Kötümser (gün);Öncüller;Sorumlu\r\nA;"Analiz; ilk";2;3;6;;Ali\r\nB;Tasarım;3;5,5;10;A;\r\n\r\n';
  const satirlar = csvOku(csv);
  assert.equal(satirlar.length, 2);
  const r = satirlardanProje(satirlar, { id: 'x', ad: 'X', baslangic: '2026-12-01' });
  assert.deepEqual(r.eksik, []);
  assert.equal(r.proje.isler[0].ad, 'Analiz; ilk');
  assert.equal(r.proje.isler[1].olasi, 5.5);
  assert.deepEqual(r.proje.isler[1].onculler, ['A']);
  assert.equal(r.proje.isler[0].sorumlu, 'Ali');
  assert.equal(hataVar(dogrula(r.proje)), false);
});

test('Pusula dışa aktarması + tahmin sütunları: kod yoksa satır no, biten işte süre tarihlerden', () => {
  const satirlar = [
    { 'İş': 'Kapsam', Durum: 'Tamamlandı', Sorumlular: 'Ayşe', 'Başlangıç': '2026-11-02', Tamamlanma: '06.11.2026', Iyimser: '', 'Olası': '', 'Kötümser': '' },
    { 'İş': 'Geliştirme', Durum: 'Devam ediyor', Sorumlular: 'Can', 'Başlangıç': '', Tamamlanma: '', Iyimser: 3, 'Olası': 5, 'Kötümser': 9, 'Öncüller': '1' },
    { 'İş': 'Eski iş', Durum: 'İptal', Sorumlular: '', 'Başlangıç': '', Tamamlanma: '', Iyimser: 1, 'Olası': 1, 'Kötümser': 1 },
  ];
  const r = satirlardanProje(satirlar, { id: 'p', ad: 'P', baslangic: '2026-11-02' });
  assert.equal(r.otomatikKod, true);
  assert.equal(r.atlanan.iptal, 1);
  assert.equal(r.tarihtenHesaplanan, 1);
  assert.equal(r.proje.isler[0].gerceklesen, 5);
  assert.equal(r.proje.isler[0].durum, 'bitti');
  assert.equal(r.proje.isler[1].durum, 'devam');
  assert.deepEqual(r.proje.isler[1].onculler, ['1']);
  assert.equal(hataVar(dogrula(r.proje)), false);
});

test('İçe aktarma güven sınırı: kontrol karakteri, uzunluk, satır sınırı', () => {
  const r = satirlardanProje([{ kod: 'A', ad: 'x\u0000y'.padEnd(500, 'z'), iyimser: '1', olasi: '2', kotumser: 'üç' }], { id: 'a', ad: 'a', baslangic: '2026-12-01' });
  assert.ok(!r.proje.isler[0].ad.includes('\u0000'));
  assert.ok(r.proje.isler[0].ad.length <= 120);
  assert.ok(dogrula(r.proje).some((b) => b.kod === 'sayi_degil'));
  assert.throws(() => satirlardanProje(Array.from({ length: 501 }, () => ({})), { id: 'a', ad: 'a', baslangic: '2026-12-01' }), /En çok/);
  assert.throws(() => csvOku('a'.repeat(2_000_001)), /büyük/);
});

test('CSV dışa aktarma: formül enjeksiyonu önlenir, sayılar korunur', () => {
  const t = csvYaz(['a', 'b'], [['=HYPERLINK("x")', -5], ['+1', 2.5], ['@x', '-3']]);
  assert.ok(t.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(t.includes(';-5'));
  assert.ok(t.includes("'+1;2,5"));
  assert.ok(t.includes("'@x;-3"));
});

test('Performans: 10.000 tur 17 işte 1 saniyenin altında', () => {
  const s = simuleEt(PANEL, { tur: 10000 });
  assert.ok(s.sureMs < 1000, `${s.sureMs} ms`);
  assert.equal(s.egri.length, 101);
  assert.equal(s.histogram.reduce((t, h) => t + h[2], 0), 10000);
});
