import { LiveIsland } from '@/components/LiveIsland';
import { useOrders } from '@/context/OrdersContext';
import { useUiState } from '@/context/UiStateContext';
import { shopLiveSnapshot } from '@/lib/liveActivity';
import { pollWhileForeground } from '@/lib/foreground';
import { usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

/** Dynamic Island in-app (option réglages, off par défaut). */
export function OrderLiveActivityHost() {
  const { activeOrders } = useOrders();
  const { liveIslandEnabled } = useUiState();
  const pathname = usePathname();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!liveIslandEnabled || !activeOrders.length) return;
    return pollWhileForeground(() => setNow(Date.now()), 1000);
  }, [liveIslandEnabled, activeOrders.length]);

  const snapshots = useMemo(
    () => activeOrders.map((order) => shopLiveSnapshot(order, now)),
    [activeOrders, now],
  );

  if (!liveIslandEnabled) return null;
  if (!snapshots.length) return null;
  if (pathname.startsWith('/tracking')) return null;
  if (pathname.startsWith('/(auth)') || pathname.startsWith('/login')) return null;

  return <LiveIsland snapshots={snapshots} />;
}
