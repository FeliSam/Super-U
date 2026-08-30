import { useEffect, type ReactNode } from 'react';
import { getLocalDb } from '@/lib/db/client';

/** Opens SQLite and seeds the catalog. Does not block the UI. */
export function LocalDbBoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    void getLocalDb();
  }, []);

  return children;
}
