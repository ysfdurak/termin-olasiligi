import { useDil } from '../i18n.js';
import { sayi, tamSayi } from '../bicim.js';
import { ucNokta } from '../../cekirdek/ag.ts';
import { pertOrtalama, pertSapma } from '../../cekirdek/rastgele.ts';

/** PERT dağılımının yoğunluk eğrisi (küçük çizim): a, m, b'nin yeri gözle görülsün. */
function PertCizim({ a, m, b }) {
  const G = 220;
  const Y = 70;
  if (b - a <= 0) return null;
  const al = 1 + (4 * (m - a)) / (b - a);
  const be = 1 + (4 * (b - m)) / (b - a);
  const nok = [];
  let enCok = 0;
  for (let i = 0; i <= 60; i++) {
    const x = i / 60;
    const y = x ** (al - 1) * (1 - x) ** (be - 1);
    enCok = Math.max(enCok, y);
    nok.push([x, y]);
  }
  const d = nok.map(([x, y], i) => `${i ? 'L' : 'M'}${(10 + x * (G - 20)).toFixed(1)},${(Y - 16 - (y / enCok) * (Y - 26)).toFixed(1)}`).join('');
  const gx = (v) => 10 + ((v - a) / (b - a)) * (G - 20);
  const mu = pertOrtalama(a, m, b);
  return (
    <svg viewBox={`0 0 ${G} ${Y}`} className="pert-cizim" aria-hidden="true">
      <path d={d + `L${G - 10},${Y - 16}L10,${Y - 16}Z`} className="alan" />
      <line x1={gx(mu)} x2={gx(mu)} y1="8" y2={Y - 16} className="ort" />
      {[
        [a, 'a'],
        [m, 'm'],
        [b, 'b'],
      ].map(([v, e]) => (
        <text key={e} x={gx(v)} y={Y - 3} textAnchor="middle">
          {e}={v}
        </text>
      ))}
    </svg>
  );
}

export function Nasil({ proje, sim, gecerli }) {
  const { t, dil } = useDil();
  const s = sim.sonuc;
  if (!gecerli) return <div className="kart ileti hata">{t('hata_var')}</div>;
  if (!s) return <div className="kart yukleniyor">{t('hesaplaniyor')}</div>;
  const o = s.ornekTur;
  const kritik = new Set(o.kritikYol);
  const ornekIs = proje.isler.find((is) => !(is.durum === 'bitti' && is.gerceklesen !== undefined) && is.kotumser > is.iyimser) || proje.isler[0];
  const ad = Object.fromEntries(proje.isler.map((i) => [i.kod, i.ad]));
  const sirali = [...proje.isler].sort((x, y) => o.baslangic[x.kod] - o.baslangic[y.kod] || o.bitis[x.kod] - o.bitis[y.kod]);
  const enGec = o.toplam || 1;

  return (
    <div className="nasil">
      <p className="soluk">{t('nasil_alt')}</p>

      <section className="kart">
        <h2>{t('nasil_1')}</h2>
        <p>{t('nasil_1_metin')}</p>
        <div className="formul" aria-label="μ = (a + 4m + b) / 6, σ = (b − a) / 6">
          <span>μ = (a + 4m + b) / 6</span>
          <span>σ = (b − a) / 6</span>
        </div>
        {ornekIs && (
          <div className="pert-ornek">
            <PertCizim a={ornekIs.iyimser} m={ornekIs.olasi} b={ornekIs.kotumser} />
            <p className="kucuk">
              <b>
                {ornekIs.kod} · {ornekIs.ad}
              </b>
              <br />μ = ({ornekIs.iyimser} + 4×{ornekIs.olasi} + {ornekIs.kotumser}) / 6 = <b>{sayi(pertOrtalama(ornekIs.iyimser, ornekIs.olasi, ornekIs.kotumser), dil, 2)}</b>
              <br />σ = ({ornekIs.kotumser} − {ornekIs.iyimser}) / 6 = <b>{sayi(pertSapma(ornekIs.iyimser, ornekIs.kotumser), dil, 2)}</b>
            </p>
          </div>
        )}
      </section>

      <section className="kart">
        <h2>{t('nasil_2')}</h2>
        <p>{t('nasil_2_metin')}</p>
        <div className="tablo-kap">
          <table className="tablo tur-tablo">
            <thead>
              <tr>
                <th>{t('sut_is')}</th>
                <th className="sayi">{t('nasil_sure')}</th>
                <th className="sayi">{t('nasil_basla')}</th>
                <th className="sayi">{t('nasil_biter')}</th>
                <th className="gantt-bas" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {sirali.map((is) => {
                const k = is.kod;
                const [a, , b] = ucNokta(is);
                return (
                  <tr key={k} className={kritik.has(k) ? 'kritik' : ''}>
                    <td>
                      <span className="kod-rozet">{k}</span> {ad[k]}
                    </td>
                    <td className="sayi">
                      {sayi(o.sureler[k], dil)}
                      <span className="soluk kucuk"> ({a === b ? a : `${a}–${b}`})</span>
                    </td>
                    <td className="sayi">{sayi(o.baslangic[k], dil)}</td>
                    <td className="sayi">{sayi(o.bitis[k], dil)}</td>
                    <td className="gantt" aria-hidden="true">
                      <span className="gantt-cubuk" style={{ marginLeft: `${(o.baslangic[k] / enGec) * 100}%`, width: `${Math.max(0.5, (o.sureler[k] / enGec) * 100)}%` }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p>
          <b>{t('nasil_tur_toplam', { n: sayi(o.toplam, dil), yol: o.kritikYol.join(' → ') })}</b>
        </p>
      </section>

      <section className="kart">
        <h2>{t('nasil_3')}</h2>
        <p>{t('nasil_3_metin', { tur: tamSayi(s.tur, dil), p85: sayi(s.p85, dil) })}</p>
      </section>

      <section className="kart">
        <h2>{t('nasil_4')}</h2>
        <p>{t('nasil_4_metin')}</p>
      </section>

      <section className="kart">
        <h2>{t('nasil_5')}</h2>
        <ul>
          {t('nasil_5_liste').map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
