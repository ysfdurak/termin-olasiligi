// Tohumlu rastgele sayı üreteci ve dağılımlar.
// Aynı tohum her yerde (tarayıcı, Worker, sunucu, testler) aynı sayı dizisini verir; bu sayede
// web ve MCP aynı projede aynı sonucu gösterir, senaryo karşılaştırması da gürültüsüz olur.

/** Mulberry32: 32 bit durumlu, hızlı ve simülasyon için yeterli kalitede üreteç. [0, 1) döner. */
export function uretec(tohum: number): () => number {
  let s = tohum >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Metinden kararlı tohum (FNV-1a). Proje kimliğinden tohum üretmek için. */
export function metindenTohum(metin: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < metin.length; i++) {
    h ^= metin.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Standart normal (Box–Muller). Çiftin ikinci değeri saklanır. */
export function normalUretec(r: () => number): () => number {
  let yedek: number | null = null;
  return function () {
    if (yedek !== null) {
      const y = yedek;
      yedek = null;
      return y;
    }
    let u = 0;
    while (u === 0) u = r();
    const v = r();
    const k = Math.sqrt(-2 * Math.log(u));
    yedek = k * Math.sin(2 * Math.PI * v);
    return k * Math.cos(2 * Math.PI * v);
  };
}

/** Gamma(alfa, 1), alfa ≥ 1 için Marsaglia–Tsang. PERT'te alfa her zaman ≥ 1'dir. */
export function gamma(alfa: number, r: () => number, n: () => number): number {
  const d = alfa - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = n();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * PERT dağılımının biçim parametreleri (λ = 4).
 * Beta(α, β) değeri [a, b] aralığına ölçeklenir; tepe noktası m'dedir, ortalaması (a + 4m + b) / 6.
 */
export function pertParametre(a: number, m: number, b: number): { alfa: number; beta: number } {
  const g = b - a;
  return { alfa: 1 + (4 * (m - a)) / g, beta: 1 + (4 * (b - m)) / g };
}

/** PERT dağılımından bir süre çeker. a = b ise sabit süredir. */
export function pertCek(a: number, m: number, b: number, r: () => number, n: () => number): number {
  if (b - a <= 0) return a;
  const { alfa, beta } = pertParametre(a, m, b);
  const x = gamma(alfa, r, n);
  const y = gamma(beta, r, n);
  return a + (x / (x + y)) * (b - a);
}

export function pertOrtalama(a: number, m: number, b: number): number {
  return (a + 4 * m + b) / 6;
}

/** Klasik PERT yaklaşık standart sapması (b − a) / 6. */
export function pertSapma(a: number, b: number): number {
  return (b - a) / 6;
}
