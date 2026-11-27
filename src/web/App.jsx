import { useCallback, useEffect, useMemo, useState } from 'react';
import { ornekProjeler } from '../cekirdek/ornekler.ts';
import { DilBaglam, cevirici, dilBul } from './i18n.js';
import { kaydet, kayitVarMi, yukle } from './depo.js';
import { ekran, olay, olcumYukle } from './olcum.js';
import { Projeler } from './ekranlar/Projeler.jsx';
import { ProjeEkrani } from './ekranlar/ProjeEkrani.jsx';

const SEKMELER = ['sonuc', 'isler', 'senaryo', 'nasil'];

function rotaOku() {
  const m = location.hash.match(/^#\/p\/([a-z0-9-]{1,40})(?:\/([a-z]+))?/);
  if (m) return { ekran: 'proje', id: m[1], sekme: SEKMELER.includes(m[2]) ? m[2] : 'sonuc' };
  return { ekran: 'projeler' };
}

export function yeniKimlik() {
  return 'p-' + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 9);
}

export function App() {
  const [dil, setDil] = useState(dilBul);
  const t = useMemo(() => cevirici(dil), [dil]);
  const [rota, setRota] = useState(rotaOku);
  const [kayit, setKayit] = useState(yukle);
  const kayitAcik = useMemo(kayitVarMi, []);

  useEffect(() => {
    document.documentElement.lang = dil;
    document.title = `${t('marka')} · ${t('slogan')}`;
    try {
      localStorage.setItem('termin.dil', dil);
    } catch {
      /* kayıt kapalı */
    }
  }, [dil, t]);
  useEffect(() => olcumYukle(dil), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = () => setRota(rotaOku());
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  useEffect(() => {
    ekran(rota.ekran === 'proje' ? rota.sekme : 'projeler');
    window.scrollTo(0, 0);
  }, [rota.ekran, rota.sekme, rota.id]);
  useEffect(() => void kaydet(kayit), [kayit]);

  const ornekler = useMemo(() => ornekProjeler(undefined, dil).map((p) => kayit.ornekDegisiklik[p.id] || p), [dil, kayit.ornekDegisiklik]);
  const tumu = [...ornekler, ...kayit.projeler];
  const proje = rota.ekran === 'proje' ? tumu.find((p) => p.id === rota.id) : null;

  const projeGuncelle = useCallback((p) => {
    setKayit((k) =>
      p.id.startsWith('ornek-')
        ? { ...k, ornekDegisiklik: { ...k.ornekDegisiklik, [p.id]: p } }
        : { ...k, projeler: k.projeler.map((x) => (x.id === p.id ? p : x)) },
    );
  }, []);
  const projeEkle = useCallback((p, git = true) => {
    setKayit((k) => ({ ...k, projeler: [...k.projeler, p] }));
    if (git) location.hash = `#/p/${p.id}/${p.isler.length ? 'sonuc' : 'isler'}`;
  }, []);
  const projeSil = useCallback((id) => setKayit((k) => ({ ...k, projeler: k.projeler.filter((x) => x.id !== id) })), []);
  const ornekSifirla = useCallback((id) => setKayit((k) => {
    const o = { ...k.ornekDegisiklik };
    delete o[id];
    return { ...k, ornekDegisiklik: o };
  }), []);
  const dilSec = (d) => {
    setDil(d);
    olay('dil_degisti');
  };

  return (
    <DilBaglam.Provider value={{ dil, t, dilSec }}>
      <header className="ust">
        <div className="ic">
          <a href="#/" className="marka">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="logo">
              <path d="M3 20 C8 20 9 4 12 4 C15 4 16 20 21 20" />
              <path d="M15.2 13 V20" className="p85" />
            </svg>
            {t('marka')}
          </a>
          <span className="slogan">{t('slogan')}</span>
          <span className="bosluk" />
          <span className="demo-etiket">{t('demo')}</span>
          <div className="dil" role="group" aria-label="Dil / Language">
            {['tr', 'en'].map((d) => (
              <button key={d} type="button" aria-pressed={dil === d} onClick={() => dilSec(d)}>
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>
      {!kayitAcik && <div className="serit uyari">{t('kayit_yok')}</div>}
      <main>
        {rota.ekran === 'projeler' && (
          <Projeler ornekler={ornekler} kendi={kayit.projeler} degisenOrnek={kayit.ornekDegisiklik} projeEkle={projeEkle} projeSil={projeSil} ornekSifirla={ornekSifirla} yeniKimlik={yeniKimlik} />
        )}
        {rota.ekran === 'proje' && proje && <ProjeEkrani key={proje.id} proje={proje} sekme={rota.sekme} guncelle={projeGuncelle} />}
        {rota.ekran === 'proje' && !proje && (
          <div className="kart">
            <p>{t('bulunamadi')}</p>
            <a href="#/">{t('geri')}</a>
          </div>
        )}
      </main>
      <footer className="alt-bilgi">
        <div className="ic">
          <span>© 2026 Yusuf Durak · {t('alt_lisans')}</span>
          <a href="https://github.com/ysfdurak/termin-olasiligi" rel="noopener" target="_blank">
            {t('alt_kaynak')}
          </a>
          <a href={dil === 'en' ? 'https://ysfdurak.com/en/privacy/' : 'https://ysfdurak.com/tr/gizlilik/'} rel="noopener" target="_blank">
            {t('alt_gizlilik')}
          </a>
          <a href="https://ysfdurak.com" rel="noopener" target="_blank">
            ysfdurak.com
          </a>
        </div>
      </footer>
    </DilBaglam.Provider>
  );
}
