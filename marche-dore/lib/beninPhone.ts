/** Numéros Bénin (+229) — 10 chiffres nationaux, affichés +229 01 00 00 00 00. */

export const BENIN_PHONE_PLACEHOLDER = '+229 01 00 00 00 00';

export function stripPhoneDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/** Plan 2024 : mobile 01…, fixe 02… Anciens 8 chiffres → préfixe ajouté. */
function toNational10(digits: string): string | null {
  let d = digits;
  if (d.startsWith('00229')) d = d.slice(5);
  if (d.startsWith('229')) d = d.slice(3);
  if (d.length === 10 && (d.startsWith('01') || d.startsWith('02'))) return d;
  if (d.length === 8) return `${d.startsWith('2') ? '02' : '01'}${d}`;
  return null;
}

/** Chiffres nationaux (sans 229), toujours 10. */
export function nationalBeninDigits(input: string): string | null {
  return toNational10(stripPhoneDigits(input));
}

export function isValidBeninPhone(input: string): boolean {
  return nationalBeninDigits(input) !== null;
}

/** Affichage canonique : +229 01 00 00 00 00 */
export function formatBeninPhone(input: string): string {
  const n = nationalBeninDigits(input);
  if (!n) return input.trim();
  const parts: string[] = [];
  for (let i = 0; i < n.length; i += 2) parts.push(n.slice(i, i + 2));
  return `+229 ${parts.join(' ')}`;
}

/** Masque : +229 01 *** ** ** 00 */
export function maskBeninPhone(input: string): string {
  const n = nationalBeninDigits(input);
  if (!n) return '••••';
  return `+229 ${n.slice(0, 2)} *** ** ** ${n.slice(-2)}`;
}

/** Saisie progressive (affiche +229 + 5 groupes de 2). */
export function formatBeninPhoneInput(raw: string): string {
  let d = stripPhoneDigits(raw);
  if (d.startsWith('229')) d = d.slice(3);
  d = d.slice(0, 10);
  if (!d) return '+229 ';
  const parts: string[] = [];
  for (let i = 0; i < d.length; i += 2) parts.push(d.slice(i, i + 2));
  return `+229 ${parts.join(' ')}`;
}
