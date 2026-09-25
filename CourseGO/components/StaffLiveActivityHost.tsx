import { LiveIsland } from '@/components/LiveIsland';
import { useBoard } from '@/context/BoardContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { staffLiveSnapshots } from '@/lib/liveActivity';
import { usePathname } from 'expo-router';
import { useMemo } from 'react';

export function StaffLiveActivityHost() {
  const { staff } = useStaffAuth();
  const { jobs, deliveries } = useBoard();
  const pathname = usePathname();
  const snapshots = useMemo(
    () => staffLiveSnapshots(staff?.id, jobs, deliveries),
    [staff?.id, jobs, deliveries],
  );

  if (!snapshots.length) return null;
  if (pathname.startsWith('/job/') || pathname.startsWith('/run/')) return null;
  if (pathname.startsWith('/login')) return null;

  return <LiveIsland snapshots={snapshots} accent="#058d81" followLabel="Ouvrir" />;
}
