/**
 * Normalisation des numéros béninois : renvoie les 10 chiffres nationaux (01/02 + 8 chiffres)
 * ou null si le numéro n'est pas exploitable. Même règle que la fonction SQL
 * public.national_phone_digits (schema-p0.sql) : les comparaisons sont EXACTES, jamais par suffixe.
 */
export function nationalBeninDigits(phone: string): string | null {
  let d = String(phone ?? '').replace(/\D/g, '');
  if (d.startsWith('00229')) d = d.slice(5);
  else if (d.startsWith('229')) d = d.slice(3);
  if (d.length === 10 && (d.startsWith('01') || d.startsWith('02'))) return d;
  if (d.length === 8) return `${d.startsWith('2') ? '02' : '01'}${d}`;
  return null;
}
