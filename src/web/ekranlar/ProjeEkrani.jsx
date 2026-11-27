import { useMemo, useState } from 'react';
import { dogrula, hataVar } from '../../cekirdek/ag.ts';
import { useDil } from '../i18n.js';
import { useSim } from '../useSim.js';
import { tamSayi } from '../bicim.js';
import { Sonuc } from './Sonuc.jsx';
import { Isler } from './Isler.jsx';
import { Senaryo } from './Senaryo.jsx';
import { Nasil } from './Nasil.jsx';

const TURLAR = [1000, 10000, 50000];

export function ProjeEkrani({ proje, sekme, guncelle }) {
  const { t, dil } = useDil();
  const [tur, setTur] = useState(10000);
  const bulgular = useMemo(() => dogrula(proje), [proje]);
  const gecerli = !hataVar(bulgular);
  const sim = useSim(proje, tur, gecerli);
  const alan = (k, v) => guncelle({ ...proje, [k]: v || undefined });
  const hataSayisi = bulgular.filter((b) => b.seviye === 'hata').length;

  return (
    <>
      <nav className="iz" aria-label="breadcrumb">
        <a href="#/">← {t('projeler')}</a>
      </nav>
      <section className="proje-bas">
        <label className="ad-alani">
          <span className="gizli">{t('proje_adi')}</span>
          <input className="proje-adi" value={proje.ad} maxLength={120} onChange={(e) => guncelle({ ...proje, ad: e.target.value })} aria-label={t('proje_adi')} />
        </label>
        <div className="proje-ayar">
          <label>
            {t('baslangic')}
            <input type="date" value={proje.baslangic} required onChange={(e) => e.target.value && alan('baslangic', e.target.value)} />
          </label>
          <label>
            {t('plan_tarihi')}
            <input type="date" value={proje.planTarihi || ''} onChange={(e) => alan('planTarihi', e.target.value)} />
          </label>
          {(proje.durumTarihi || proje.isler.some((i) => i.durum === 'bitti' || i.durum === 'devam')) && (
            <label title={t('veri_tarihi_ipucu')}>
              {t('veri_tarihi')}
              <input type="date" value={proje.durumTarihi || ''} onChange={(e) => alan('durumTarihi', e.target.value)} />
            </label>
          )}
          <label>
            {t('tur_sayisi')}
            <select value={tur} onChange={(e) => setTur(Number(e.target.value))}>
              {TURLAR.map((x) => (
                <option key={x} value={x}>
                  {tamSayi(x, dil)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <nav className="sekmeler" aria-label={proje.ad}>
        {[
          ['sonuc', t('sekme_sonuc')],
          ['isler', t('sekme_isler') + (hataSayisi ? ` (${hataSayisi}!)` : '')],
          ['senaryo', t('sekme_senaryo')],
          ['nasil', t('sekme_nasil')],
        ].map(([k, ad]) => (
          <a key={k} href={`#/p/${proje.id}/${k}`} aria-current={sekme === k ? 'page' : undefined} className={k === 'isler' && hataSayisi ? 'hatali' : undefined}>
            {ad}
          </a>
        ))}
        <span className="sim-durum" aria-live="polite">
          {sim.hesapliyor ? t('hesaplaniyor') : ''}
        </span>
      </nav>
      {sekme === 'sonuc' && <Sonuc proje={proje} sim={sim} bulgular={bulgular} gecerli={gecerli} />}
      {sekme === 'isler' && <Isler proje={proje} guncelle={guncelle} bulgular={bulgular} sim={sim} />}
      {sekme === 'senaryo' && <Senaryo proje={proje} sim={sim} gecerli={gecerli} tur={tur} />}
      {sekme === 'nasil' && <Nasil proje={proje} sim={sim} gecerli={gecerli} />}
    </>
  );
}
