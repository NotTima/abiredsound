// Общее для сайта, админки и сервера: размеры и итоги по строкам шансов.
// Сам расчёт шансов в js/model-calc.js: его получают только сервер и админка.

// В груз 2×3 падает только 2×3, в 3×2 только 3×2: такие формы не поворачиваются.
export const turns = ([w, h]) => Math.max(w, h) < 3;

export function fits([w, h], [sw, sh], rot) {
  return (w === sw && h === sh) || (rot && turns([w, h]) && w === sh && h === sw);
}

// ev — ожидаемая стоимость предмета, price — ожидаемая цена груза (при «любой» цене зависит от того,
// какие предметы вероятнее), profit — шанс, что предмет дороже своего груза.
export function summarize(rows) {
  const ev = rows.reduce((s, r) => s + r.p * r.item.contactPrice, 0);
  const price = rows.reduce((s, r) => s + r.p * r.cargoPrice, 0);
  const profit = rows.reduce((s, r) => s + r.p * r.ok, 0);
  return { ev, price, profit };
}
