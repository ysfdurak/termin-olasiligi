import { useState } from 'react';
import { tahminSapmasi, KALIBRASYON_ESIGI } from '../../cekirdek/sapma.ts';
import { csvYaz, SABLON_BASLIKLARI, projedenSatirlar } from '../../cekirdek/ice-aktar.ts';
import { bulguMetni } from '../../cekirdek/metin.ts';
import { useDil } from '../i18n.js';
import { gunTarih, sayi, tamSayi, tarih, yuzde } from '../bicim.js';
import { Egri } from '../bilesenler/Egri.jsx';
import { dosyaAdi, indir, xlsxYaz } from '../xlsx.js';
import { sonucSayfalari } from '../disaAktar.js';
import { olay } from '../olcum.js';

export function Bulgular({ bulgular, baslik }) {
  const { dil } = useDil();
  if (!bulgular.length) return null;
  return (
    <div className="bulgu-kutu">
      {baslik && <h3>{baslik}</h3>}
      <ul className="bulgular">
        {bulgular.map((b, i) => (
          <li key={i} className={b.seviye}>
            {bulguMetni(b, dil)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function olasilikSinifi(p) {
  return p >= 0.8 ? 'iyi' : p >= 0.5 ? 'orta' : 'kotu';
}

export function Sonuc({ proje, sim, bulgular, gecerli }) {
  const { t, dil } = useDil();
  const [tumu, setTumu] = useState(false);
  const [kopya, setKopya] = useState(false);
  if (!gecerli)
    return (
      <div className="kart">
        <p className="ileti hata">{t('hata_var')}</p>
        <Bulgular bulgular={bulgular.filter((b) => b.seviye === 'hata')} />
        <a className="dugme" href={`#/p/${proje.id}/isler`}>
          {t('islere_git')}
        </a>
      </div>
    );
  const s = sim.sonuc;
  if (!s) return <div className="kart yukleniyor">{t('hesaplaniyor')}</div>;
  const isAd = Object.fromEntries(proje.isler.map((i) => [i.kod, i]));
  const sirali = [...s.isler].filter((x) => isAd[x.kod]).sort((a, b) => b.duyarlilik - a.duyarlilik || b.kritiklik - a.kritiklik);
  const gorunen = tumu ? sirali : sirali.slice(0, 8);
  const sapma = tahminSapmasi(proje);
  const uyarilar = bulgular.filter((b) => b.seviye === 'uyari');
  const enBuyuk = Math.max(s.deterministik, s.pert.p85, s.p85);

  const enRiskli = sirali.find((x) => !x.sabit) || sirali[0];
  const ozetCumle = t('ozet_cumle', {
    ad: proje.ad,
    p85: gunTarih(proje, s.p85, dil, true),
    p50: gunTarih(proje, s.p50, dil, true),
    plan: s.plan ? t('ozet_plan', { tarih: tarih(proje.planTarihi, dil, true), olas: yuzde(s.plan.olasilik, dil) }) : '',
    risk: enRiskli ? `${enRiskli.kod} · ${isAd[enRiskli.kod].ad}` : '—',
  });
  async function kopyala() {
    try {
      await navigator.clipboard.writeText(ozetCumle);
      setKopya(true);
      setTimeout(() => setKopya(false), 2000);
    } catch {
      /* pano izni yoksa metin zaten seçilebilir */
    }
  }

  function excel() {
    olay('disa_aktar');
    indir(xlsxYaz(sonucSayfalari(proje, s, dil)), dosyaAdi(proje.ad) + '.xlsx');
  }
  function csv() {
    olay('disa_aktar');
    indir(new Blob([csvYaz(SABLON_BASLIKLARI, projedenSatirlar(proje))], { type: 'text/csv;charset=utf-8' }), dosyaAdi(proje.ad) + '.csv');
  }

  return (
    <div className={'sonuc' + (sim.hesapliyor ? ' eskiyor' : '')}>
      <section className="kart manset">
        {s.plan ? (
          <p className="plan-cumle">
            {t('plan_cumle', { tarih: tarih(proje.planTarihi, dil, true), gun: s.plan.gun })}{' '}
            <b className={'olasilik ' + olasilikSinifi(s.plan.olasilik)}>{yuzde(s.plan.olasilik, dil)}</b>
          </p>
        ) : (
          <p className="soluk">{t('plan_yok')}</p>
        )}
        <div className="yuzdelikler">
          {[
            ['p50', s.p50],
            ['p85', s.p85],
            ['p95', s.p95],
          ].map(([k, v]) => (
            <div key={k} className={'yuzdelik ' + k}>
              <span className="yz-ad">{t(k + '_ad')}</span>
              <b>{gunTarih(proje, v, dil, true)}</b>
              <span className="yz-gun">{t('is_gunu', { n: sayi(v, dil) })}</span>
              <span className="yz-alt">{t(k + '_alt')}</span>
            </div>
          ))}
        </div>
        {s.gecenGun !== undefined && <p className="soluk kucuk">{t('veri_tarihi_not', { tarih: tarih(proje.durumTarihi, dil), n: s.gecenGun })}</p>}
        <div className="ozet-cumle">
          <span className="ozet-etiket">{t('ozet_baslik')}</span>
          <p>{ozetCumle}</p>
          <button type="button" className="dugme metin" onClick={kopyala} aria-live="polite">
            {kopya ? t('kopyalandi') : t('kopyala_dugme')}
          </button>
        </div>
      </section>

      <section className="kart">
        <h2>{t('egri_baslik')}</h2>
        <Egri proje={proje} sonuc={s} />
      </section>

      <div className="iki">
        <section className="kart">
          <h2>{t('riskli_baslik')}</h2>
          <p className="soluk kucuk">{t('riskli_alt')}</p>
          <table className="tablo riskli">
            <thead>
              <tr>
                <th>{t('sut_is')}</th>
                <th className="sayi">{t('sut_duyarlilik')}</th>
                <th className="sayi">{t('sut_kritiklik')}</th>
              </tr>
            </thead>
            <tbody>
              {gorunen.map((x) => (
                <tr key={x.kod}>
                  <td>
                    <span className="kod-rozet">{x.kod}</span> {isAd[x.kod].ad}
                    {x.sabit && <span className="soluk kucuk"> · {isAd[x.kod].durum === 'bitti' ? t('bitti_etiket') : t('sabit')}</span>}
                  </td>
                  <td className="sayi">
                    <span className="cubuk-hucre">
                      <span className="cubuk-ic duy" style={{ width: `${Math.max(0, x.duyarlilik) * 100}%` }} />
                    </span>
                    {sayi(x.duyarlilik, dil, 2)}
                  </td>
                  <td className="sayi">
                    <span className="cubuk-hucre">
                      <span className="cubuk-ic kr" style={{ width: `${x.kritiklik * 100}%` }} />
                    </span>
                    {yuzde(x.kritiklik, dil)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sirali.length > 8 && (
            <button type="button" className="dugme metin" onClick={() => setTumu(!tumu)}>
              {tumu ? '−' : `+ ${sirali.length - 8}`}
            </button>
          )}
        </section>

        <section className="kart">
          <h2>{t('klasik_baslik')}</h2>
          <div className="kiyas">
            {[
              ['klasik_olasi', s.deterministik],
              ['klasik_pert', s.pert.p85],
              ['klasik_mc', s.p85],
            ].map(([k, v]) => (
              <div key={k} className={'kiyas-satir ' + k}>
                <span>{t(k)}</span>
                <span className="kiyas-cubuk">
                  <span style={{ width: `${(v / enBuyuk) * 100}%` }} />
                </span>
                <b>{sayi(v, dil)}</b>
              </div>
            ))}
          </div>
          <p className="kucuk">{t('klasik_aciklama')}</p>
          <Bulgular bulgular={uyarilar} baslik={t('uyarilar')} />
        </section>
      </div>

      {sapma.toplam && (
        <section className="kart">
          <h2>{t('sapma_baslik')}</h2>
          <p>
            {t('sapma_metin', {
              n: sapma.toplam.adet,
              oran: yuzde(Math.abs(sapma.toplam.oran - 1), dil),
              yon: sapma.toplam.oran >= 1 ? t('sapma_uzun') : t('sapma_kisa'),
            })}
          </p>
          <table className="tablo dar">
            <thead>
              <tr>
                <th>{t('sut_kategori')}</th>
                <th className="sayi">{t('sut_adet')}</th>
                <th className="sayi">{t('sut_oran')}</th>
              </tr>
            </thead>
            <tbody>
              {sapma.kategoriler.map((k) => (
                <tr key={k.kategori}>
                  <td>{k.kategori}</td>
                  <td className="sayi">{k.adet}</td>
                  <td className="sayi">× {sayi(k.oran, dil, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="soluk kucuk">{t('sapma_not', { esik: KALIBRASYON_ESIGI })}</p>
        </section>
      )}

      <section className="kart disa">
        <h2>{t('disa_aktar')}</h2>
        <div className="arac-cubugu">
          <button type="button" className="dugme ikincil" onClick={excel}>
            {t('excel_indir')}
          </button>
          <button type="button" className="dugme ikincil" onClick={csv}>
            {t('csv_indir')}
          </button>
          <button type="button" className="dugme ikincil" onClick={() => (olay('disa_aktar'), window.print())}>
            {t('yazdir')}
          </button>
        </div>
        <p className="soluk kucuk">{t('sinir_notu')}</p>
        <p className="soluk kucuk">{t('tur_bilgi', { tur: tamSayi(s.tur, dil), ms: s.sureMs, tohum: s.tohum })}</p>
      </section>
    </div>
  );
}
