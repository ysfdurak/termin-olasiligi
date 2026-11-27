// İş ağı önizlemesi: işler seviyelere (en uzun öncül zinciri) göre sütunlara dizilir.
// Kalın çerçeve: en olası sürelerle kritik yol. Kritiklik verilirse kutunun alt şeridi onu gösterir.
import { useMemo } from 'react';
import { siraBul } from '../../cekirdek/ag.ts';
import { useDil } from '../i18n.js';
import { yuzde } from '../bicim.js';

const KG = 168;
const KY = 50;
const ARA_X = 46;
const ARA_Y = 14;

export function Ag({ proje, kritikYol = [], kritiklik }) {
  const { dil, t } = useDil();
  const yer = useMemo(() => {
    const { tamam, sira } = siraBul(proje.isler);
    if (!tamam) return null;
    const seviye = {};
    for (const i of sira) {
      const is = proje.isler[i];
      seviye[is.kod] = Math.max(-1, ...is.onculler.map((o) => seviye[o] ?? -1)) + 1;
    }
    const sutun = [];
    for (const is of proje.isler) (sutun[seviye[is.kod]] ||= []).push(is);
    const konum = {};
    sutun.forEach((l, s) => l.forEach((is, r) => (konum[is.kod] = { x: 8 + s * (KG + ARA_X), y: 8 + r * (KY + ARA_Y) })));
    const g = 16 + sutun.length * (KG + ARA_X) - ARA_X;
    const y = 16 + Math.max(...sutun.map((l) => l.length)) * (KY + ARA_Y) - ARA_Y;
    return { konum, g, y };
  }, [proje]);
  if (!yer) return null;
  const kritik = new Set(kritikYol);
  const kr = kritiklik ? Object.fromEntries(kritiklik.map((x) => [x.kod, x.kritiklik])) : null;
  return (
    <div className="ag-kap">
      <svg viewBox={`0 0 ${yer.g} ${yer.y}`} width={yer.g} height={yer.y} className="ag" role="img" aria-label={t('ag_baslik')}>
        <defs>
          <marker id="ok" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" className="ok" />
          </marker>
        </defs>
        {proje.isler.flatMap((is) =>
          is.onculler.map((o) => {
            const a = yer.konum[o];
            const b = yer.konum[is.kod];
            const x1 = a.x + KG;
            const y1 = a.y + KY / 2;
            const x2 = b.x - 2;
            const y2 = b.y + KY / 2;
            const k = kritik.has(o) && kritik.has(is.kod);
            return <path key={o + '>' + is.kod} d={`M${x1},${y1} C${x1 + ARA_X / 2},${y1} ${x2 - ARA_X / 2},${y2} ${x2},${y2}`} className={'kenar' + (k ? ' kritik' : '')} markerEnd="url(#ok)" />;
          }),
        )}
        {proje.isler.map((is) => {
          const { x, y } = yer.konum[is.kod];
          const bitti = is.durum === 'bitti';
          const sure = bitti && is.gerceklesen !== undefined ? `✓ ${is.gerceklesen}` : `${is.iyimser}–${is.olasi}–${is.kotumser}`;
          return (
            <g key={is.kod} className={'kutu' + (kritik.has(is.kod) ? ' kritik' : '') + (bitti ? ' bitti' : '')} transform={`translate(${x},${y})`}>
              <title>{`${is.kod} · ${is.ad}`}</title>
              <rect width={KG} height={KY} rx="7" />
              <text x="9" y="18" className="kod">
                {is.kod}
              </text>
              <text x={KG - 9} y="18" textAnchor="end" className="sure">
                {sure}
              </text>
              <text x="9" y="37" className="ad">
                {is.ad.length > 24 ? is.ad.slice(0, 23) + '…' : is.ad}
              </text>
              {kr && kr[is.kod] !== undefined && !bitti && (
                <>
                  <rect x="1" y={KY - 5} width={(KG - 2) * kr[is.kod]} height="4" className="kr-serit" />
                  <title>{`${t('sut_kritiklik')}: ${yuzde(kr[is.kod], dil)}`}</title>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
