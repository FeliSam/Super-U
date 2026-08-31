export function productFamilyName(name: string, unit?: string): string {
  let family = name.trim();
  const trimmedUnit = (unit ?? '').trim();
  if (trimmedUnit) {
    const escaped = trimmedUnit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    family = family.replace(new RegExp(`\\s*${escaped}\\s*$`, 'i'), '').trim();
  }
  return family || name.trim();
}

export function productFamilyKey(name: string, unit: string | undefined, categoryId: string): string {
  const token = productFamilyName(name, unit)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return `${categoryId}:${token}`;
}

function unitSortKey(unit: string): number {
  const n = unit.replace(',', '.').toLowerCase();
  const pack = n.match(/(\d+)\s*x\s*([\d.]+)\s*(cl|ml|l)\b/);
  if (pack) {
    const count = Number(pack[1]);
    const amount = Number(pack[2]);
    const unitCode = pack[3];
    const ml = unitCode === 'l' ? amount * 1000 : unitCode === 'cl' ? amount * 10 : amount;
    return count * ml;
  }
  const mass = n.match(/([\d.]+)\s*(kg|g|l|ml|cl)\b/);
  if (mass) {
    const amount = Number(mass[1]);
    const unitCode = mass[2];
    if (unitCode === 'kg' || unitCode === 'l') return amount * 1000;
    if (unitCode === 'cl') return amount * 10;
    return amount;
  }
  const lot = n.match(/lot de (\d+)/);
  if (lot) return Number(lot[1]);
  return Number.MAX_SAFE_INTEGER;
}

export function sortByUnit<T extends { payload?: { unit?: string }; unit?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const unitA = a.payload?.unit ?? a.unit ?? '';
    const unitB = b.payload?.unit ?? b.unit ?? '';
    return unitSortKey(unitA) - unitSortKey(unitB);
  });
}

export function preferredVariantId<T extends { id: string; payload?: { unit?: string } }>(items: T[]): string {
  const kilo = items.find((item) => /^1\s*kg$/i.test(String(item.payload?.unit ?? '').trim()));
  return (kilo ?? sortByUnit(items)[0])?.id ?? items[0]!.id;
}
