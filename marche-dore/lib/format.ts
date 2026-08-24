export function formatFcfa(amount: number) {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} F`;
}
