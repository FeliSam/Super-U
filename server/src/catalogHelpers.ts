export type CatalogCursor = { updatedAt: string; id: string };

export function boundedLimit(raw: string | undefined, maximum = 2000): number | null {
  if (raw == null || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return null;
  return Math.min(value, maximum);
}

export function encodeCatalogCursor(cursor: CatalogCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCatalogCursor(raw: string | undefined): CatalogCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<CatalogCursor>;
    if (
      typeof parsed.updatedAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.updatedAt)) ||
      typeof parsed.id !== 'string' ||
      !parsed.id
    ) return null;
    return { updatedAt: parsed.updatedAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function normalizeBarcode(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const value = String(raw).trim();
  return /^\d{8}$|^\d{12,14}$/.test(value) ? value : null;
}
