import { useEffect, useRef } from 'react';
import { subscribePulse, startAdminCache, getPulse, type CacheDomain } from '@/lib/cachedApi';

/** Relance `refresh` si le tampon du domaine change (ou après une mutation admin). */
export function useLiveSync(refresh: () => void, enabled = true, domain?: CacheDomain) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const stampRef = useRef('');

  useEffect(() => {
    if (!enabled) return;
    startAdminCache();
    let timer = 0;
    const run = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => refreshRef.current(), 160);
    };
    const unsub = subscribePulse((force) => {
      const p = getPulse();
      if (!p && !force) return;
      const next = !p
        ? stampRef.current
        : domain === 'overview'
          ? `${p.catalog}|${p.orders}`
          : domain
            ? p[domain]
            : p.stamp;
      if (!force && stampRef.current && stampRef.current === next) return;
      stampRef.current = next;
      run();
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [enabled, domain]);
}
