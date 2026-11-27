import { useEffect, useState } from 'react';
import { sayiOku } from '../../cekirdek/ice-aktar.ts';
import { useDil } from '../i18n.js';
import { Ag } from '../bilesenler/Ag.jsx';
import { Bulgular } from './Sonuc.jsx';
import { olay } from '../olcum.js';

/** Metin olarak düzenlenen hücre: yazarken bozulmaz, değer her tuşta üst bileşene gider. */
function Hucre({ deger, degis, bitince, sayi, etiket, ...kalan }) {
  const goster = (v) => (v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v)) ? '' : String(v));
  const [metin, setMetin] = useState(goster(deger));
  useEffect(() => {
    const disari = goster(deger);
    if (sayi ? sayiOku(metin) !== deger && !(Number.isNaN(deger) && metin.trim()) : metin !== disari) setMetin(disari);
  }, [deger]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      {...kalan}
      aria-label={etiket}
      value={metin}
      inputMode={sayi ? 'decimal' : undefined}
      onChange={(e) => {
        setMetin(e.target.value);
        degis(sayi ? (sayiOku(e.target.value) ?? NaN) : e.target.value);
      }}
      onBlur={bitince}
    />
  );
}

function sonrakiKod(isler) {
  const kodlar = new Set(isler.map((i) => i.kod));
  if (isler.every((i) => /^\d+$/.test(i.kod)) && isler.length) return String(Math.max(...isler.map((i) => Number(i.kod))) + 1);
  const harf = (n) => (n < 26 ? String.fromCharCode(65 + n) : harf(Math.floor(n / 26) - 1) + String.fromCharCode(65 + (n % 26)));
  for (let n = 0; ; n++) if (!kodlar.has(harf(n))) return harf(n);
}

export function Isler({ proje, guncelle, bulgular, sim }) {
  const { t } = useDil();
  const [eskiKod, setEskiKod] = useState({});
  const hataliKod = new Set(bulgular.filter((b) => b.seviye === 'hata').flatMap((b) => b.isler || []));
  const uyariKod = new Set(bulgular.filter((b) => b.seviye === 'uyari').flatMap((b) => b.isler || []));
  const islerGuncelle = (isler) => guncelle({ ...proje, isler });
  const alan = (i, k, v) => {
    const yeni = proje.isler.slice();
    const is = { ...yeni[i] };
    if (v === '' || v === undefined) delete is[k];
    else is[k] = v;
    yeni[i] = is;
    islerGuncelle(yeni);
  };
  // Kod değişince (alan bırakılınca) öncüllerdeki eski kod da yenilenir
  const kodBitti = (i) => {
    const eski = eskiKod[i];
    const yeniKod = proje.isler[i].kod;
    setEskiKod((m) => ({ ...m, [i]: undefined }));
    if (!eski || eski === yeniKod) return;
    islerGuncelle(proje.isler.map((is, j) => (j === i ? is : { ...is, onculler: is.onculler.map((o) => (o === eski ? yeniKod : o)) })));
  };
  const ekle = () => {
    olay('is_ekle');
    const son = proje.isler[proje.isler.length - 1];
    islerGuncelle([...proje.isler, { kod: sonrakiKod(proje.isler), ad: '', iyimser: 1, olasi: 2, kotumser: 4, onculler: son ? [son.kod] : [] }]);
  };
  const sil = (i) => {
    const kod = proje.isler[i].kod;
    islerGuncelle(proje.isler.filter((_, j) => j !== i).map((is) => ({ ...is, onculler: is.onculler.filter((o) => o !== kod) })));
  };
  const hatalar = bulgular.filter((b) => b.seviye === 'hata');
  const uyarilar = bulgular.filter((b) => b.seviye === 'uyari');

  return (
    <>
      <section className="kart">
        <p className="soluk kucuk">{t('isler_alt')}</p>
        {hatalar.length ? <Bulgular bulgular={hatalar} baslik={t('hatalar')} /> : <p className="ileti tamam">{t('sorun_yok')}</p>}
        <div className="tablo-kap">
          <table className="tablo duzen">
            <thead>
              <tr>
                <th>{t('sut_kod')}</th>
                <th className="genis">{t('sut_ad')}</th>
                <th className="sayi">{t('sut_iyimser')}</th>
                <th className="sayi">{t('sut_olasi')}</th>
                <th className="sayi">{t('sut_kotumser')}</th>
                <th>{t('sut_onculler')}</th>
                <th>{t('sut_sorumlu')}</th>
                <th>{t('sut_kategori')}</th>
                <th>{t('sut_durum')}</th>
                <th className="sayi">{t('sut_gerceklesen')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {proje.isler.map((is, i) => {
                const bitti = is.durum === 'bitti';
                return (
                  <tr key={i} className={(hataliKod.has(is.kod) ? 'satir-hata' : uyariKod.has(is.kod) ? 'satir-uyari' : '') + (bitti ? ' satir-bitti' : '')}>
                    <td>
                      <Hucre className="kod" deger={is.kod} etiket={t('sut_kod')} maxLength={20} degis={(v) => (eskiKod[i] === undefined && setEskiKod((m) => ({ ...m, [i]: is.kod })), alan(i, 'kod', v.trim()))} bitince={() => kodBitti(i)} />
                    </td>
                    <td>
                      <Hucre deger={is.ad} etiket={t('sut_ad')} maxLength={120} degis={(v) => alan(i, 'ad', v)} />
                    </td>
                    {['iyimser', 'olasi', 'kotumser'].map((k) => (
                      <td key={k} className="sayi">
                        <Hucre sayi className="sayi" deger={is[k]} etiket={t('sut_' + k)} degis={(v) => alan(i, k, v)} disabled={bitti && is.gerceklesen !== undefined} />
                      </td>
                    ))}
                    <td>
                      <Hucre
                        deger={is.onculler.join(', ')}
                        etiket={t('sut_onculler')}
                        maxLength={200}
                        degis={(v) => alan(i, 'onculler', v.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean))}
                      />
                    </td>
                    <td>
                      <Hucre deger={is.sorumlu || ''} etiket={t('sut_sorumlu')} maxLength={80} degis={(v) => alan(i, 'sorumlu', v)} />
                    </td>
                    <td>
                      <Hucre deger={is.kategori || ''} etiket={t('sut_kategori')} maxLength={60} degis={(v) => alan(i, 'kategori', v)} />
                    </td>
                    <td>
                      <select aria-label={t('sut_durum')} value={is.durum || 'bekliyor'} onChange={(e) => alan(i, 'durum', e.target.value === 'bekliyor' ? '' : e.target.value)}>
                        <option value="bekliyor">{t('durum_bekliyor')}</option>
                        <option value="devam">{t('durum_devam')}</option>
                        <option value="bitti">{t('durum_bitti')}</option>
                      </select>
                    </td>
                    <td className="sayi">
                      <Hucre sayi className="sayi" deger={is.gerceklesen} etiket={t('sut_gerceklesen')} disabled={!bitti} degis={(v) => alan(i, 'gerceklesen', Number.isFinite(v) ? v : undefined)} />
                    </td>
                    <td>
                      <button type="button" className="sil" aria-label={t('is_sil', { kod: is.kod })} title={t('is_sil', { kod: is.kod })} onClick={() => sil(i)}>
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="dugme ikincil" onClick={ekle} disabled={proje.isler.length >= 500}>
          + {t('is_ekle')}
        </button>
        {uyarilar.length > 0 && <Bulgular bulgular={uyarilar} baslik={t('uyarilar')} />}
      </section>
      {!hatalar.length && (
        <section className="kart">
          <h2>{t('ag_baslik')}</h2>
          <p className="soluk kucuk">{t('ag_alt')}</p>
          <Ag proje={proje} kritikYol={sim.sonuc?.deterministikYol} kritiklik={sim.sonuc?.isler} />
        </section>
      )}
    </>
  );
}
