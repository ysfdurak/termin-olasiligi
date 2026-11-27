// Doğrulama bulgularının metni (TR/EN). Web ve MCP aynı cümleyi kullanır.
import type { Bulgu } from './tipler.ts';

type Dil = 'tr' | 'en';

const M: Record<Bulgu['kod'], Record<Dil, (l: string, d: string) => string>> = {
  bos_proje: { tr: () => 'Projede hiç iş yok.', en: () => 'The project has no tasks.' },
  cok_is: { tr: (_l, d) => `En çok ${d} iş olabilir.`, en: (_l, d) => `At most ${d} tasks are allowed.` },
  kod_bos: { tr: (l) => `Kodu boş bir iş var${l ? ` (${l})` : ''}.`, en: (l) => `A task has no code${l ? ` (${l})` : ''}.` },
  kod_bicim: { tr: (l) => `${l}: kod en çok 20 karakter olmalı; harf, rakam, nokta, tire, alt çizgi.`, en: (l) => `${l}: a code is at most 20 letters, digits, dots, dashes or underscores.` },
  kod_tekrar: { tr: (l) => `${l} kodu birden fazla işte kullanılmış.`, en: (l) => `Code ${l} is used by more than one task.` },
  ad_bos: { tr: (l) => `${l}: iş adı boş.`, en: (l) => `${l}: task name is empty.` },
  sayi_degil: { tr: (l) => `${l}: üç tahminin üçü de sayı olmalı.`, en: (l) => `${l}: all three estimates must be numbers.` },
  negatif: { tr: (l) => `${l}: süre negatif olamaz.`, en: (l) => `${l}: a duration cannot be negative.` },
  sira: { tr: (l) => `${l}: iyimser ≤ olası ≤ kötümser olmalı.`, en: (l) => `${l}: optimistic ≤ most likely ≤ pessimistic is required.` },
  cok_buyuk: { tr: (l, d) => `${l}: süre en çok ${d} iş günü olabilir.`, en: (l, d) => `${l}: a duration can be at most ${d} working days.` },
  bilinmeyen_oncul: { tr: (l, d) => `${l}: öncül "${d}" projede yok.`, en: (l, d) => `${l}: predecessor "${d}" does not exist.` },
  kendine_oncul: { tr: (l) => `${l}: iş kendi öncülü olamaz.`, en: (l) => `${l}: a task cannot depend on itself.` },
  cok_oncul: { tr: (l, d) => `${l}: en çok ${d} öncül olabilir.`, en: (l, d) => `${l}: at most ${d} predecessors.` },
  dongu: { tr: (l) => `Bağımlılıklar döngü oluşturuyor: ${l}.`, en: (l) => `The dependencies form a loop: ${l}.` },
  tek_nokta: { tr: (l) => `${l}: üç tahmin aynı; iş sabit süreli sayılır, belirsizliği yok.`, en: (l) => `${l}: all three estimates are equal; the task is treated as fixed, with no uncertainty.` },
  kopuk: { tr: (l) => `Hiçbir işe bağlı olmayan iş: ${l}. Bağımlılık unutulmuş olabilir.`, en: (l) => `Not connected to any task: ${l}. A dependency may be missing.` },
  cakisan_sorumlu: {
    tr: (l, d) => `${d}: ${l} aynı anda yürüyebilir. Araç kaynak kısıtını hesaba katmaz; gerçekte sırayla yapılacaksa öncül ekleyin.`,
    en: (l, d) => `${d}: ${l} can run at the same time. The tool does not model resource limits; if they will be done one after another, add a predecessor.`,
  },
  tarih_bicim: {
    tr: (_l, d) => (d === 'planTarihi' ? 'Plan tarihi geçerli bir tarih değil.' : d === 'durumTarihi' ? 'Veri tarihi geçerli değil ya da başlangıçtan önce.' : 'Başlangıç tarihi geçerli bir tarih değil.'),
    en: (_l, d) => (d === 'planTarihi' ? 'The committed date is not a valid date.' : d === 'durumTarihi' ? 'The status date is invalid or before the start.' : 'The start date is not a valid date.'),
  },
  plan_once: { tr: () => 'Plan tarihi başlangıçtan önce olamaz.', en: () => 'The committed date cannot be before the start date.' },
};

export function bulguMetni(b: Bulgu, dil: Dil = 'tr'): string {
  const ve = dil === 'tr' ? ' ve ' : ' and ';
  const l = (b.isler || []).join(b.kod === 'dongu' ? ' → ' : b.kod === 'cakisan_sorumlu' ? ve : ', ');
  return M[b.kod][dil](l, b.deger || '');
}
