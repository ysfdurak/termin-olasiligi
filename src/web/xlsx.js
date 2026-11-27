// Küçük Excel (.xlsx) okuyucu ve yazıcı. Dış kitaplık yalnız fflate (zip).
// Okuma güven sınırıdır: dosya boyutu okunmadan önce, açılmış boyut ve parça sayısı AÇILIRKEN sayılarak sınırlanır
// (zip'teki beyan edilen boyuta güvenilmez; 200 KB'lık dosya 200 MB'a açılabilir).
import { Unzip, UnzipInflate, strFromU8, strToU8, zipSync } from 'fflate';

export const DOSYA_SINIRI = 5 * 1024 * 1024;
const ACILMIS_SINIRI = 40 * 1024 * 1024;
const PARCA_SINIRI = 300;
const GEREKLI = /^xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/sheet\d+\.xml)$/;

function ac(bayt) {
  const dosyalar = {};
  let toplam = 0;
  let parca = 0;
  let hata = null;
  const uz = new Unzip((f) => {
    if (++parca > PARCA_SINIRI) hata = new Error('zip: parça sayısı');
    if (hata || !GEREKLI.test(f.name)) return;
    const parcalar = [];
    f.ondata = (err, veri, son) => {
      if (hata) return;
      if (err) return void (hata = err);
      toplam += veri.length;
      if (toplam > ACILMIS_SINIRI) {
        hata = new Error('zip: açılmış boyut');
        f.terminate();
        return;
      }
      parcalar.push(veri);
      if (son) {
        const hepsi = new Uint8Array(parcalar.reduce((t, p) => t + p.length, 0));
        let o = 0;
        for (const p of parcalar) (hepsi.set(p, o), (o += p.length));
        dosyalar[f.name] = strFromU8(hepsi);
      }
    };
    f.start();
  });
  uz.register(UnzipInflate);
  const ADIM = 65536;
  for (let i = 0; i < bayt.length && !hata; i += ADIM) uz.push(bayt.subarray(i, i + ADIM), i + ADIM >= bayt.length);
  if (hata) throw hata;
  return dosyalar;
}

function sutunNo(ref) {
  const harf = ref.match(/^[A-Z]+/)?.[0] || 'A';
  let n = 0;
  for (const c of harf) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** İlk çalışma sayfasını satır nesnelerine çevirir (ilk satır başlık). */
export function xlsxOku(bayt) {
  if (bayt.length > DOSYA_SINIRI) throw new Error('boyut');
  const d = ac(bayt);
  const xml = (m) => new DOMParser().parseFromString(m, 'application/xml');
  const ortak = d['xl/sharedStrings.xml']
    ? [...xml(d['xl/sharedStrings.xml']).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join(''))
    : [];
  // Kitaptaki ilk sayfanın dosyası (sıra rels üzerinden)
  let sayfaYolu = 'xl/worksheets/sheet1.xml';
  if (d['xl/workbook.xml'] && d['xl/_rels/workbook.xml.rels']) {
    const ilk = xml(d['xl/workbook.xml']).getElementsByTagName('sheet')[0];
    const rid = ilk?.getAttribute('r:id') || ilk?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = [...xml(d['xl/_rels/workbook.xml.rels']).getElementsByTagName('Relationship')].find((r) => r.getAttribute('Id') === rid);
    const hedef = rel?.getAttribute('Target');
    if (hedef) sayfaYolu = hedef.startsWith('/') ? hedef.slice(1) : 'xl/' + hedef.replace(/^\.\//, '');
  }
  const sayfa = d[sayfaYolu] || Object.entries(d).find(([k]) => k.startsWith('xl/worksheets/'))?.[1];
  if (!sayfa) throw new Error('sayfa yok');
  const satirlar = [];
  for (const row of xml(sayfa).getElementsByTagName('row')) {
    const s = [];
    for (const c of row.getElementsByTagName('c')) {
      const tur = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent;
      let deger;
      if (tur === 's') deger = ortak[Number(v)] ?? '';
      else if (tur === 'inlineStr') deger = [...c.getElementsByTagName('t')].map((t) => t.textContent).join('');
      else if (tur === 'str' || tur === 'b' || tur === 'e') deger = v ?? '';
      else deger = v === undefined || v === '' ? '' : Number(v);
      s[sutunNo(c.getAttribute('r') || '')] = deger;
    }
    satirlar.push(s);
    if (satirlar.length > 1001) break;
  }
  const dolu = satirlar.filter((s) => s.some((x) => x !== undefined && String(x).trim() !== ''));
  if (!dolu.length) return [];
  const bas = Array.from(dolu[0], (b, i) => (b === undefined || String(b).trim() === '' ? `Sütun ${i + 1}` : String(b).trim()));
  return dolu.slice(1).map((s) => Object.fromEntries(bas.map((b, i) => [b, s[i] ?? ''])));
}

// --- Yazma ---
const kac = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function harf(i) {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

function sayfaXml(sayfa) {
  const cols = (sayfa.genislik || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const satirlar = sayfa.satirlar
    .map((r, ri) => {
      const hucre = r
        .map((v, ci) => {
          const ref = harf(ci) + (ri + 1);
          const stil = ri === 0 && sayfa.baslikli !== false ? ' s="1"' : typeof v === 'number' && sayfa.yuzde?.includes(ci) ? ' s="2"' : typeof v === 'number' ? ' s="3"' : '';
          if (v === '' || v === null || v === undefined) return '';
          // Metin her zaman satır içi metin olarak yazılır: hücre formül olarak yorumlanmaz (formül enjeksiyonu yok).
          return typeof v === 'number' && Number.isFinite(v) ? `<c r="${ref}"${stil}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${stil}><is><t xml:space="preserve">${kac(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${ri + 1}">${hucre}</row>`;
    })
    .join('');
  const don = sayfa.baslikli !== false ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${don}${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${satirlar}</sheetData></worksheet>`;
}

/** sayfalar: [{ ad, satirlar: (string|number)[][], genislik?: number[], yuzde?: number[] }] */
export function xlsxYaz(sayfalar) {
  const ad = (s) => kac(String(s).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  const dosyalar = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sayfalar.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sayfalar.map((s, i) => `<sheet name="${ad(s.ad)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sayfalar.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sayfalar.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
  };
  sayfalar.forEach((s, i) => (dosyalar[`xl/worksheets/sheet${i + 1}.xml`] = sayfaXml(s)));
  const zip = zipSync(Object.fromEntries(Object.entries(dosyalar).map(([k, v]) => [k, strToU8(v)])), { level: 6 });
  return new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function indir(blob, ad) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ad;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function dosyaAdi(s) {
  return String(s).replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'proje';
}
