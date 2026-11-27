import { useRef, useState } from 'react';
import { csvOku, METIN_SINIRI, satirlardanProje } from '../../cekirdek/ice-aktar.ts';
import { dogrula, hataVar } from '../../cekirdek/ag.ts';
import { bugun, ilkIsGunu } from '../../cekirdek/takvim.ts';
import { ornekProjeler } from '../../cekirdek/ornekler.ts';
import { bulguMetni } from '../../cekirdek/metin.ts';
import { useDil } from '../i18n.js';
import { tarih } from '../bicim.js';
import { DOSYA_SINIRI, indir, xlsxOku, xlsxYaz } from '../xlsx.js';
import { YEDEK_SINIRI, yedekMetni, yedektenOku } from '../depo.js';
import { olay } from '../olcum.js';
import { sablonSayfalari } from '../disaAktar.js';

function Kart({ p, ornek, degisti, sil, sifirla, kopyala }) {
  const { t, dil } = useDil();
  return (
    <article className="proje-kart">
      <div className="pk-ust">
        {ornek && <span className="rozet">{t('ornek_etiket')}</span>}
        {degisti && <span className="rozet soluk">{t('degisti')}</span>}
        <span className="soluk kucuk">{t('is_sayisi', { n: p.isler.length })}</span>
      </div>
      <h3>
        <a href={`#/p/${p.id}/sonuc`}>{p.ad}</a>
      </h3>
      {p.aciklama && <p className="soluk kucuk">{p.aciklama}</p>}
      <dl className="pk-tarih">
        <div>
          <dt>{t('baslangic')}</dt>
          <dd>{tarih(p.baslangic, dil)}</dd>
        </div>
        <div>
          <dt>{t('plan_tarihi')}</dt>
          <dd>{tarih(p.planTarihi, dil)}</dd>
        </div>
      </dl>
      <div className="pk-alt">
        <a className="dugme" href={`#/p/${p.id}/sonuc`}>
          {t('ac')}
        </a>
        <button type="button" className="dugme ikincil" onClick={kopyala}>
          {t('kopyala')}
        </button>
        {sifirla && degisti && (
          <button type="button" className="dugme metin" onClick={sifirla}>
            {t('sifirla')}
          </button>
        )}
        {sil && (
          <button type="button" className="dugme metin tehlike" onClick={sil}>
            {t('sil')}
          </button>
        )}
      </div>
    </article>
  );
}

export function Projeler({ ornekler, kendi, degisenOrnek, projeEkle, projeSil, ornekSifirla, yeniKimlik }) {
  const { t, dil } = useDil();
  const dosya = useRef(null);
  const yedek = useRef(null);
  const [aktarma, setAktarma] = useState(null);
  const [ileti, setIleti] = useState(null);

  function kopyala(p) {
    projeEkle({ ...structuredClone(p), id: yeniKimlik(), ad: p.ad + (dil === 'en' ? ' (copy)' : ' (kopya)') });
  }
  function yeni() {
    olay('yeni_proje');
    const id = yeniKimlik();
    projeEkle({ id, ad: dil === 'en' ? 'New project' : 'Yeni proje', baslangic: ilkIsGunu(bugun()), isler: [{ kod: 'A', ad: dil === 'en' ? 'First task' : 'İlk iş', iyimser: 2, olasi: 3, kotumser: 6, onculler: [] }] }, false);
    location.hash = `#/p/${id}/isler`;
  }
  async function dosyaSec(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    setIleti(null);
    if (!f) return;
    if (f.size > DOSYA_SINIRI) return setIleti({ hata: true, metin: t('dosya_buyuk', { mb: 5 }) });
    try {
      let satirlar;
      const bayt = new Uint8Array(await f.arrayBuffer());
      // Dosya türü uzantıdan değil içerikten: .xlsx bir zip arşividir ("PK" ile başlar)
      if (bayt[0] === 0x50 && bayt[1] === 0x4b) satirlar = xlsxOku(bayt);
      else if (bayt[0] === 0xd0 && bayt[1] === 0xcf) throw new Error(dil === 'en' ? 'old .xls format; save as .xlsx' : 'eski .xls biçimi; .xlsx olarak kaydedin');
      else {
        if (f.size > METIN_SINIRI) return setIleti({ hata: true, metin: t('dosya_buyuk', { mb: 2 }) });
        satirlar = csvOku(await f.text());
      }
      const ad = f.name.replace(/\.(xlsx|csv|txt)$/i, '').slice(0, 80);
      const r = satirlardanProje(satirlar, { id: yeniKimlik(), ad, baslangic: ilkIsGunu(bugun()) });
      setAktarma(r);
      olay('excel_yukle');
    } catch (err) {
      setIleti({ hata: true, metin: t('dosya_okunamadi', { e: err?.message || String(err) }) });
    }
  }
  async function yedekSec(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    setIleti(null);
    if (!f) return;
    if (f.size > YEDEK_SINIRI) return setIleti({ hata: true, metin: t('dosya_buyuk', { mb: 2 }) });
    try {
      const liste = yedektenOku(await f.text(), yeniKimlik);
      const varolan = new Set(kendi.map((p) => p.id));
      liste.forEach((p) => projeEkle(varolan.has(p.id) || p.id.startsWith('ornek-') ? { ...p, id: yeniKimlik() } : p, false));
      setIleti({ metin: t('yedek_yuklendi', { n: liste.length }) });
      olay('yedek_yukle');
    } catch (err) {
      setIleti({ hata: true, metin: t('yedek_gecersiz', { e: err?.message || String(err) }) });
    }
  }
  function sablon() {
    olay('sablon_indir');
    indir(xlsxYaz(sablonSayfalari(ornekProjeler(undefined, dil)[0], dil)), dil === 'en' ? 'deadline-odds-template.xlsx' : 'termin-olasiligi-sablon.xlsx');
  }

  return (
    <>
      <section className="giris">
        <h1>{t('giris_baslik')}</h1>
        <p className="giris-metin">{t('giris_metin')}</p>
        <ol className="adimlar">
          <li>{t('giris_adim1')}</li>
          <li>{t('giris_adim2')}</li>
          <li>{t('giris_adim3')}</li>
        </ol>
      </section>

      <h2 className="bolum">{t('ornekler')}</h2>
      <div className="kartlar">
        {ornekler.map((p) => (
          <Kart key={p.id} p={p} ornek degisti={!!degisenOrnek[p.id]} sifirla={() => ornekSifirla(p.id)} kopyala={() => kopyala(p)} />
        ))}
      </div>

      <h2 className="bolum">{t('kendi')}</h2>
      <div className="arac-cubugu">
        <button type="button" className="dugme" onClick={yeni}>
          {t('yeni_proje')}
        </button>
        <button type="button" className="dugme ikincil" onClick={() => dosya.current.click()}>
          {t('excel_yukle')}
        </button>
        <button type="button" className="dugme metin" onClick={sablon}>
          {t('sablon_indir')}
        </button>
        <button type="button" className="dugme metin" onClick={() => yedek.current.click()}>
          {t('yedek_yukle')}
        </button>
        {kendi.length > 0 && (
          <button type="button" className="dugme metin" onClick={() => indir(new Blob([yedekMetni(kendi)], { type: 'application/json' }), 'termin-yedek.json')}>
            {t('yedek_indir')}
          </button>
        )}
        <input ref={dosya} type="file" accept=".xlsx,.csv,.txt" hidden onChange={dosyaSec} />
        <input ref={yedek} type="file" accept=".json,application/json" hidden onChange={yedekSec} />
      </div>
      <p className="soluk kucuk">{t('tarayicida')}</p>
      {ileti && (
        <p className={'ileti' + (ileti.hata ? ' hata' : '')} role="status">
          {ileti.metin}
        </p>
      )}
      {aktarma && <AktarmaOnizleme r={aktarma} vazgec={() => setAktarma(null)} tamam={() => (projeEkle(aktarma.proje), setAktarma(null))} />}
      {kendi.length ? (
        <div className="kartlar">
          {kendi.map((p) => (
            <Kart key={p.id} p={p} kopyala={() => kopyala(p)} sil={() => confirm(t('sil_onay', { ad: p.ad })) && projeSil(p.id)} />
          ))}
        </div>
      ) : (
        !aktarma && <p className="bos">{t('kendi_bos')}</p>
      )}

      <section className="kart mcp-kart">
        <h2>{t('mcp_baslik')}</h2>
        <p>
          {t('mcp_metin')}
          <code>https://termin.ysfdurak.com/mcp</code>
        </p>
        <p className="soluk">{t('mcp_ornek')}</p>
      </section>
    </>
  );
}

function AktarmaOnizleme({ r, vazgec, tamam }) {
  const { t, dil } = useDil();
  const bulgular = r.eksik.length ? [] : dogrula(r.proje);
  const alanAd = { kod: 'sut_kod', ad: 'sut_ad', iyimser: 'sut_iyimser', olasi: 'sut_olasi', kotumser: 'sut_kotumser', onculler: 'sut_onculler', sorumlu: 'sut_sorumlu', kategori: 'sut_kategori', durum: 'sut_durum', gerceklesen: 'sut_gerceklesen', basladi: 'baslangic', bitti: 'tamamlanma' };
  return (
    <section className="kart aktarma" aria-labelledby="aktarma-b">
      <h3 id="aktarma-b">{t('aktarma_baslik')}: {r.proje.ad}</h3>
      <p className="kucuk">
        {t('is_sayisi', { n: r.proje.isler.length })} · {t('aktarma_eslesen')}:{' '}
        {Object.entries(r.eslesen)
          .map(([alan, baslik]) => `${t(alanAd[alan])} ← "${baslik}"`)
          .join(', ')}
      </p>
      {r.eksik.length > 0 && <p className="ileti hata">{t('aktarma_eksik', { s: r.eksik.map((a) => t(alanAd[a])).join(', ') })}</p>}
      {r.otomatikKod && <p className="kucuk">{t('aktarma_otomatik_kod')}</p>}
      {r.tarihtenHesaplanan > 0 && <p className="kucuk">{t('aktarma_tarih', { n: r.tarihtenHesaplanan })}</p>}
      {r.atlanan.bos + r.atlanan.iptal > 0 && <p className="kucuk">{t('aktarma_atlanan', { n: r.atlanan.bos + r.atlanan.iptal })}</p>}
      {bulgular.length > 0 && (
        <ul className={'bulgular' + (hataVar(bulgular) ? ' hata' : '')}>
          {bulgular.slice(0, 8).map((b, i) => (
            <li key={i} className={b.seviye}>
              {bulguMetni(b, dil)}
            </li>
          ))}
          {bulgular.length > 8 && <li>…</li>}
        </ul>
      )}
      <div className="arac-cubugu">
        <button type="button" className="dugme" disabled={r.eksik.length > 0 || !r.proje.isler.length} onClick={tamam}>
          {t('aktarma_ok')}
        </button>
        <button type="button" className="dugme metin" onClick={vazgec}>
          {t('vazgec')}
        </button>
      </div>
    </section>
  );
}
