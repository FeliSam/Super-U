/** Stored as `JJ/MM/AAAA`. Also accepts ISO `YYYY-MM-DD`. */

export function parseBirthDate(value: string): Date | null {
  const t = value.trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return validDay(d, Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) ? d : null;
  }
  const fr = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const day = Number(fr[1]);
    const month = Number(fr[2]) - 1;
    const year = Number(fr[3]);
    const d = new Date(year, month, day);
    return validDay(d, year, month, day) ? d : null;
  }
  return null;
}

function validDay(d: Date, year: number, month: number, day: number) {
  return (
    !Number.isNaN(d.getTime()) &&
    d.getFullYear() === year &&
    d.getMonth() === month &&
    d.getDate() === day
  );
}

export function formatBirthDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function toIsoDate(value: string): string {
  const d = parseBirthDate(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function birthDateFromIso(iso: string): string {
  const d = parseBirthDate(iso);
  return d ? formatBirthDate(d) : '';
}

export function defaultPickerDate(value: string): Date {
  return parseBirthDate(value) ?? new Date(2000, 0, 1);
}

export function todayIso(): string {
  return toIsoDate(formatBirthDate(new Date()));
}
