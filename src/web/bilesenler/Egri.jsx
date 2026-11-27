// Bitiş olasılığı eğrisi: histogram (çubuklar) + birikimli olasılık (çizgi) + %50/%85/%95 ve plan çizgileri.
// İsteğe bağlı ikinci sonuç (senaryo) aynı eksende kesikli çizgiyle çizilir.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDil } from '../i18n.js';
import { gunTarih, sayi, yuzde } from '../bicim.js';

const KENAR = { sol: 48, sag: 16, ust: 28, alt: 42 };
const DAR = '(max-width: 640px)';

/** Telefonda çizim alanı daralır: yazılar okunur boyutta kalır. */
function useDar() {
  const [dar, setDar] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(DAR).matches);
  useEffect(() => {
    const m = matchMedia(DAR);
    const f = () => setDar(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return dar;
}

function eksenAdim(aralik) {
  const ham = aralik / (typeof matchMedia !== 'undefined' && matchMedia(DAR).matches ? 5 : 8);
  const us = 10 ** Math.floor(Math.log10(ham));
  return [1, 2, 5, 10].map((x) => x * us).find((x) => x >= ham) || ham;
}

function olasilikBul(egri, gun) {
  if (gun <= egri[0][0]) return 0;
  if (gun >= egri[egri.length - 1][0]) return 1;
  for (let i = 1; i < egri.length; i++) {
    if (egri[i][0] >= gun) {
      const [x0, y0] = egri[i - 1];
      const [x1, y1] = egri[i];
      return x1 === x0 ? y1 : y0 + ((gun - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 1;
}

export function Egri({ proje, sonuc, ikinci, baslik }) {
  const { t, dil } = useDil();
  const svg = useRef(null);
  const dar = useDar();
  const G = dar ? 400 : 720;
  const Y = dar ? 300 : 300;
  const [imlec, setImlec] = useState(null);
  const tum = ikinci ? [sonuc, ikinci] : [sonuc];
  const planGun = sonuc.plan?.gun;
  const { x0, x1, adim } = useMemo(() => {
    let lo = Math.min(...tum.map((s) => s.enKisa));
    let hi = Math.max(...tum.map((s) => s.enUzun));
    if (planGun !== undefined) {
      lo = Math.min(lo, planGun);
      hi = Math.max(hi, planGun);
    }
    const pay = Math.max(0.5, (hi - lo) * 0.04);
    const a = eksenAdim(hi - lo + 2 * pay);
    return { x0: Math.floor((lo - pay) / a) * a, x1: Math.ceil((hi + pay) / a) * a, adim: a };
  }, [sonuc, ikinci, planGun, dar]);
  const gx = (v) => KENAR.sol + ((v - x0) / (x1 - x0)) * (G - KENAR.sol - KENAR.sag);
  const gy = (p) => Y - KENAR.alt - p * (Y - KENAR.ust - KENAR.alt);
  const enCok = Math.max(...tum.flatMap((s) => s.histogram.map((h) => h[2] / s.tur / (h[1] - h[0]))));
  const cubukY = (h, s) => Y - KENAR.alt - ((h[2] / s.tur / (h[1] - h[0])) / enCok) * (Y - KENAR.ust - KENAR.alt) * 0.62;
  const yol = (s) => s.egri.map(([x, p], i) => `${i ? 'L' : 'M'}${gx(x).toFixed(1)},${gy(p).toFixed(1)}`).join('');
  const isaretler = [
    ['p50', sonuc.p50, '50'],
    ['p85', sonuc.p85, '85'],
    ['p95', sonuc.p95, '95'],
  ];

  function hareket(e) {
    const r = svg.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * G;
    if (px < KENAR.sol || px > G - KENAR.sag) return setImlec(null);
    const gun = x0 + ((px - KENAR.sol) / (G - KENAR.sol - KENAR.sag)) * (x1 - x0);
    setImlec({ gun, p: olasilikBul(sonuc.egri, gun), p2: ikinci ? olasilikBul(ikinci.egri, gun) : null });
  }

  const xEtiket = [];
  for (let v = x0; v <= x1 + 1e-9; v += adim) xEtiket.push(v);

  return (
    <figure className="egri">
      {baslik && <figcaption>{baslik}</figcaption>}
      <svg
        ref={svg}
        viewBox={`0 0 ${G} ${Y}`}
        role="img"
        aria-label={`${t('egri_baslik')}: ${t('p50_ad')} ${sayi(sonuc.p50, dil)}, ${t('p85_ad')} ${sayi(sonuc.p85, dil)}, ${t('p95_ad')} ${sayi(sonuc.p95, dil)}`}
        onPointerMove={hareket}
        onPointerLeave={() => setImlec(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line x1={KENAR.sol} x2={G - KENAR.sag} y1={gy(p)} y2={gy(p)} className="izgara" />
            <text x={KENAR.sol - 6} y={gy(p) + 4} textAnchor="end" className="eksen">
              {yuzde(p, dil)}
            </text>
          </g>
        ))}
        {xEtiket.map((v) => (
          <text key={v} x={gx(v)} y={Y - KENAR.alt + 16} textAnchor="middle" className="eksen">
            {sayi(v, dil, adim < 1 ? 1 : 0)}
          </text>
        ))}
        <text x={(KENAR.sol + G - KENAR.sag) / 2} y={Y - 6} textAnchor="middle" className="eksen-ad">
          {t('egri_eksen_x')}
        </text>
        {sonuc.histogram.map((h) => (
          <rect key={h[0]} x={gx(h[0]) + 0.5} width={Math.max(0.5, gx(h[1]) - gx(h[0]) - 1)} y={cubukY(h, sonuc)} height={Y - KENAR.alt - cubukY(h, sonuc)} className="cubuk" />
        ))}
        {ikinci && ikinci.histogram.map((h) => <rect key={'b' + h[0]} x={gx(h[0]) + 0.5} width={Math.max(0.5, gx(h[1]) - gx(h[0]) - 1)} y={cubukY(h, ikinci)} height={Y - KENAR.alt - cubukY(h, ikinci)} className="cubuk ikinci" />)}
        <path d={yol(sonuc)} className="cizgi" />
        {ikinci && <path d={yol(ikinci)} className="cizgi ikinci" />}
        {!ikinci &&
          isaretler.map(([k, v, etiket], i) => (
            <g key={k} className={'isaret ' + k}>
              <line x1={gx(v)} x2={gx(v)} y1={gy(0)} y2={gy(Number(etiket) / 100)} />
              <circle cx={gx(v)} cy={gy(Number(etiket) / 100)} r="4" />
              <text x={gx(v)} y={gy(Number(etiket) / 100) - 9 - (i === 1 ? 0 : 0)} textAnchor={i === 2 ? 'start' : 'end'} dx={i === 2 ? 6 : -6}>
                {dil === 'en' ? `${etiket}%` : `%${etiket}`}
              </text>
            </g>
          ))}
        {planGun !== undefined && (
          <g className="isaret plan">
            <line x1={gx(planGun)} x2={gx(planGun)} y1={KENAR.ust - 6} y2={gy(0)} />
            <text x={gx(planGun)} y={KENAR.ust - 10} textAnchor="middle">
              {t('plan_cizgi')} · {yuzde(sonuc.plan.olasilik, dil)}
              {ikinci?.plan ? ` → ${yuzde(ikinci.plan.olasilik, dil)}` : ''}
            </text>
          </g>
        )}
        {imlec && (
          <g className="imlec">
            <line x1={gx(imlec.gun)} x2={gx(imlec.gun)} y1={KENAR.ust} y2={gy(0)} />
            <circle cx={gx(imlec.gun)} cy={gy(imlec.p)} r="4" />
            {imlec.p2 !== null && <circle cx={gx(imlec.gun)} cy={gy(imlec.p2)} r="4" className="ikinci" />}
          </g>
        )}
      </svg>
      <div className="egri-bilgi" aria-live="polite">
        {imlec ? (
          <span>
            <b>{gunTarih(proje, imlec.gun, dil)}</b> ({sayi(imlec.gun, dil)}) · {yuzde(imlec.p, dil)}
            {imlec.p2 !== null && <> → {yuzde(imlec.p2, dil)}</>}
          </span>
        ) : (
          <span className="soluk">{t('egri_alt')}</span>
        )}
      </div>
    </figure>
  );
}
