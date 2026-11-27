import { useEffect, useMemo, useRef, useState } from 'react';
import { bittiMi } from '../../cekirdek/ag.ts';
import { sayiOku } from '../../cekirdek/ice-aktar.ts';
import { useDil } from '../i18n.js';
import { gunTarih, sayi, yuzde } from '../bicim.js';
import { Egri } from '../bilesenler/Egri.jsx';
import { senaryoHesapla } from '../useSim.js';

export function Senaryo({ proje, sim, gecerli, tur }) {
  const { t, dil } = useDil();
  const acik = proje.isler.filter((is) => !bittiMi(is));
  const oneri = useMemo(() => {
    const kr = sim.sonuc?.isler?.filter((x) => !x.sabit).sort((a, b) => b.duyarlilik - a.duyarlilik)[0];
    return kr ? proje.isler.find((i) => i.kod === kr.kod) : acik[0];
  }, [sim.sonuc, proje]); // eslint-disable-line react-hooks/exhaustive-deps
  const satirYap = (is) => ({ kod: is.kod, iyimser: String(is.iyimser), olasi: String(is.olasi), kotumser: String(is.kotumser) });
  const [satirlar, setSatirlar] = useState(() => (oneri ? [satirYap(oneri)] : []));
  const [sonuc, setSonuc] = useState(null);
  const [hata, setHata] = useState(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const dokunuldu = useRef(false);
  // Sonuç sonradan gelirse (sayfa doğrudan senaryodan açıldıysa) öneri, kullanıcı bir şey değiştirmediyse yerleşir
  useEffect(() => {
    if (!dokunuldu.current && oneri) setSatirlar([satirYap(oneri)]);
  }, [oneri]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!gecerli) return <div className="kart ileti hata">{t('hata_var')}</div>;
  if (!acik.length) return <div className="kart">{t('senaryo_bitti_yok')}</div>;

  const degis = (i, k, v) => (dokunuldu.current = true) && setSatirlar((l) => l.map((s, j) => (j === i ? (k === 'kod' ? satirYap(proje.isler.find((x) => x.kod === v)) : { ...s, [k]: v }) : s)));
  async function calistir() {
    setHata(null);
    setCalisiyor(true);
    try {
      const degisiklikler = satirlar.map((s) => ({ kod: s.kod, iyimser: sayiOku(s.iyimser) ?? NaN, olasi: sayiOku(s.olasi) ?? NaN, kotumser: sayiOku(s.kotumser) ?? NaN }));
      for (const d of degisiklikler) {
        if (![d.iyimser, d.olasi, d.kotumser].every(Number.isFinite) || d.iyimser < 0) throw new Error(`${d.kod}: ${t('sut_iyimser')} / ${t('sut_olasi')} / ${t('sut_kotumser')}`);
        if (!(d.iyimser <= d.olasi && d.olasi <= d.kotumser)) throw new Error(`${d.kod}: ${t('sut_iyimser')} ≤ ${t('sut_olasi')} ≤ ${t('sut_kotumser')}`);
      }
      setSonuc(await senaryoHesapla(proje, degisiklikler, tur));
    } catch (e) {
      setHata(String(e.message || e));
    } finally {
      setCalisiyor(false);
    }
  }
  const farkMetni = (f) => (Math.abs(f) < 0.05 ? t('degismedi') : f < 0 ? t('gun_once', { n: sayi(-f, dil) }) : t('gun_sonra', { n: sayi(f, dil) }));
  const kullanilan = new Set(satirlar.map((s) => s.kod));
  const degisiklikVar = satirlar.some((s) => {
    const is = proje.isler.find((x) => x.kod === s.kod);
    return !is || ['iyimser', 'olasi', 'kotumser'].some((k) => sayiOku(s[k]) !== is[k]);
  });

  return (
    <>
      <section className="kart">
        <p className="soluk">{t('senaryo_alt')}</p>
        {oneri && <p className="kucuk">{t('senaryo_oneri', { kod: `${oneri.kod} · ${oneri.ad}` })}</p>}
        <div className="senaryo-satirlar">
          {satirlar.map((s, i) => (
            <div className="senaryo-satir" key={i}>
              <label className="genis">
                {t('senaryo_is')}
                <select value={s.kod} onChange={(e) => degis(i, 'kod', e.target.value)}>
                  {acik.map((is) => (
                    <option key={is.kod} value={is.kod} disabled={kullanilan.has(is.kod) && is.kod !== s.kod}>
                      {is.kod} · {is.ad}
                    </option>
                  ))}
                </select>
              </label>
              {['iyimser', 'olasi', 'kotumser'].map((k) => (
                <label key={k}>
                  {t('sut_' + k)}
                  <input inputMode="decimal" className="sayi" value={s[k]} onChange={(e) => degis(i, k, e.target.value)} />
                </label>
              ))}
              {satirlar.length > 1 && (
                <button type="button" className="dugme metin" onClick={() => setSatirlar((l) => l.filter((_, j) => j !== i))}>
                  {t('senaryo_kaldir')}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="arac-cubugu">
          <button type="button" className="dugme" onClick={calistir} disabled={calisiyor || !satirlar.length || !degisiklikVar}>
            {calisiyor ? t('hesaplaniyor') : t('senaryo_calistir')}
          </button>
          {satirlar.length < acik.length && (
            <button type="button" className="dugme metin" onClick={() => setSatirlar((l) => [...l, satirYap(acik.find((is) => !kullanilan.has(is.kod)))])}>
              + {t('senaryo_ekle')}
            </button>
          )}
        </div>
        {!degisiklikVar && <p className="soluk kucuk">{t('senaryo_degistir')}</p>}
        {hata && <p className="ileti hata">{hata}</p>}
      </section>
      {sonuc && (
        <>
          <section className="kart">
            <table className="tablo kiyas-tablo">
              <thead>
                <tr>
                  <th />
                  <th>{t('once')}</th>
                  <th>{t('sonra')}</th>
                  <th>{t('fark')}</th>
                </tr>
              </thead>
              <tbody>
                {['p50', 'p85', 'p95'].map((k) => (
                  <tr key={k} className={k === 'p85' ? 'vurgulu' : ''}>
                    <th>{t(k + '_ad')}</th>
                    <td>
                      {gunTarih(proje, sonuc.once[k], dil)} <span className="soluk">({sayi(sonuc.once[k], dil)})</span>
                    </td>
                    <td>
                      {gunTarih(sonuc.proje, sonuc.sonra[k], dil)} <span className="soluk">({sayi(sonuc.sonra[k], dil)})</span>
                    </td>
                    <td className={sonuc.fark[k] < -0.05 ? 'iyi' : sonuc.fark[k] > 0.05 ? 'kotu' : ''}>{farkMetni(sonuc.fark[k])}</td>
                  </tr>
                ))}
                {sonuc.once.plan && (
                  <tr>
                    <th>{t('plan_tarihi')}</th>
                    <td>{yuzde(sonuc.once.plan.olasilik, dil)}</td>
                    <td>{yuzde(sonuc.sonra.plan.olasilik, dil)}</td>
                    <td className={sonuc.fark.plan > 0.005 ? 'iyi' : sonuc.fark.plan < -0.005 ? 'kotu' : ''}>
                      {sonuc.fark.plan >= 0 ? '+' : '−'}
                      {Math.abs(Math.round(sonuc.fark.plan * 100))} {dil === 'en' ? 'pts' : 'puan'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          <section className="kart">
            <Egri proje={proje} sonuc={sonuc.once} ikinci={sonuc.sonra} />
            <p className="lejant kucuk">
              <span className="lj once" /> {t('once')} <span className="lj sonra" /> {t('sonra')}
            </p>
          </section>
        </>
      )}
    </>
  );
}
