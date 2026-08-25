/** Numéros Bénin (+229) — 8 ou 10 chiffres nationaux. */

export function stripPhoneDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/** Chiffres nationaux (sans 229). */
export function nationalBeninDigits(input: string): string | null {
  let d = stripPhoneDigits(input);
  if (d.startsWith('00229')) d = d.slice(5);
  if (d.startsWith('229')) d = d.slice(3);
  if (d.length === 8 || d.length === 10) return d;
  return null;
}

export function isValidBeninPhone(input: string): boolean {
  return nationalBeninDigits(input) !== null;
}

/** Affichage canonique : +229 XX XX XX XX[ XX] */
export function formatBeninPhone(input: string): string {
  const n = nationalBeninDigits(input);
  if (!n) return input.trim();
  const parts: string[] = [];
  for (let i = 0; i < n.length; i += 2) parts.push(n.slice(i, i + 2));
  return `+229 ${parts.join(' ')}`;
}

/** Masque pour checkout / liste : +229 97 *** ** 56 */
export function maskBeninPhone(input: string): string {
  const n = nationalBeninDigits(input);
  if (!n) return '••••';
  const head = n.slice(0, 2);
  const tail = n.slice(-2);
  return `+229 ${head} *** ** ${tail}`;
}

/** Saisie progressive (affiche +229 + groupes). */
export function formatBeninPhoneInput(raw: string): string {
  let d = stripPhoneDigits(raw);
  if (d.startsWith('229')) d = d.slice(3);
  d = d.slice(0, 10);
  if (!d) return '+229 ';
  const parts: string[] = [];
  for (let i = 0; i < d.length; i += 2) parts.push(d.slice(i, i + 2));
  return `+229 ${parts.join(' ')}`;
}
