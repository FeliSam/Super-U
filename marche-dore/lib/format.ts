export function formatFcfa(amount: number) {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} F`;
}

/** Rue + ville sans répéter le nom de ville déjà dans la ligne. */
export function formatOrderAddress(line: string, city: string) {
  const street = (line ?? '').trim();
  const loc = (city ?? '').trim();
  if (!street) return loc;
  if (!loc) return street;
  const hay = street.toLowerCase();
  const cityName = loc.split(',')[0]?.trim().toLowerCase() ?? '';
  if (cityName && hay.includes(cityName)) return street;
  return `${street}, ${loc}`;
}
