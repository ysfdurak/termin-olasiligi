// Dışa aktarılan Excel'de sayı biçimi: tam sayı binlik ayraçlı (#,##0), ondalık bir basamak (#,##0.0), yüzde %.
// Windows Excel testindeki bulgu: "Tur sayısı" 10000 yerine 10000,0 görünüyordu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
// @ts-expect-error web modülü düz JavaScript; tür bildirimi yok
import { xlsxYaz } from '../src/web/xlsx.js';

test('xlsx: tam sayı #,##0, ondalık #,##0.0, yüzde sütunu %', async () => {
  const blob = xlsxYaz([{ ad: 'Özet', satirlar: [['Ad', 'Değer', 'Oran'], ['Tur sayısı', 10000, 0.5], ['Ortalama', 42.25, 0.875], ['Plan', { v: 40, ondalik: true }, '']], yuzde: [2] }]);
  const z = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const stil = strFromU8(z['xl/styles.xml']), sayfa = strFromU8(z['xl/worksheets/sheet1.xml']);
  const xfs = [...stil.match(/<cellXfs[^>]*>(.*)<\/cellXfs>/s)![1].matchAll(/<xf [^>]*numFmtId="(\d+)"/g)].map((m) => Number(m[1]));
  const bicim = (ref: string) => xfs[Number(sayfa.match(new RegExp(`<c r="${ref}"(?: s="(\\d+)")?`))![1] ?? 0)];
  assert.equal(bicim('B2'), 3, 'tur sayısı tam sayı: #,##0 (Türkçe Excel: 10.000)');
  assert.equal(bicim('B3'), 164, 'ondalık değer');
  assert.match(stil, /numFmtId="164" formatCode="#,##0\.0"/);
  assert.equal(bicim('C2'), 9, 'yüzde sütunu');
  assert.equal(bicim('B4'), 164, 'ondalik: true → 40 de 40,0 görünür (süre sütunu tutarlı)');
  assert.match(sayfa, /<c r="B4" s="\d+"><v>40<\/v>/);
  assert.match(sayfa, /<c r="B2" s="\d+"><v>10000<\/v>/, 'değer saf sayı kalır');
});
