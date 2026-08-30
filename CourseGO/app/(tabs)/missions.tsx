import { AppHeader } from '@/components/AppHeader';
import { ApiBanner } from '@/components/ApiBanner';
import { MissionCard, deliveryCardProps, pickCardProps } from '@/components/MissionCard';
import { MissionSkeleton } from '@/components/Skeleton';
import { SectionHead } from '@/components/SectionHead';
import { Screen } from '@/components/ui';
import { bodyFont, colors } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useTabContentPadding } from '@/hooks/useTabContentPadding';
import { ApiError } from '@/lib/api/http';
import { claimDelivery, claimPick } from '@/lib/api/ops';
import { isActivePickStatus, isDeliveryActive, isDeliveryClaimable } from '@/lib/opsModel';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';

export default function MissionsScreen() {
  const { staff } = useStaffAuth();
  const { jobs, deliveries, refresh, refreshing, lastError } = useBoard();
  const pad = useTabContentPadding();
  const [busy, setBusy] = useState<string | null>(null);
  const activePick = jobs.find((j) => isActivePickStatus(j.pick_status));
  const queuedPicks = jobs.filter((j) => j.pick_status === 'queued');
  const pickQueue = activePick ? [activePick] : queuedPicks.slice(0, 1);
  const mineDel = deliveries.filter(isDeliveryActive).slice(0, 1);
  const claimable = deliveries.filter(isDeliveryClaimable);
  const preferredDel = claimable.find((d) => d.picker_id === staff?.id) ?? claimable[0];
  const readyDel = activePick || mineDel.length ? [] : preferredDel ? [preferredDel] : [];
  const empty = !pickQueue.length && !readyDel.length && !mineDel.length;

  useFocusEffect(
    useCallback(() => {
      void refresh({ silent: true });
    }, [refresh]),
  );

  const takePick = async (id: string) => {
    setBusy(id);
    try {
      await claimPick(id);
      await refresh();
      router.push(`/job/${encodeURIComponent(id)}`);
    } catch (e) {
      Alert.alert('Course', e instanceof ApiError && e.status === 409 ? 'Déjà pris' : (e as Error).message);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const takeDel = async (id: string) => {
    setBusy(id);
    try {
      await claimDelivery(id);
      await refresh();
      router.push(`/run/${encodeURIComponent(id)}`);
    } catch (e) {
      Alert.alert('Livraison', e instanceof ApiError ? e.message : (e as Error).message);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: pad }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <AppHeader
          title="Courses"
          subtitle="Une course à ramasser · une livraison à la fois"
          refreshing={refreshing}
          onRefresh={() => void refresh()}
        />
        {lastError ? <ApiBanner message={lastError} onRetry={() => void refresh()} /> : null}
        {refreshing && empty ? (
          <>
            <MissionSkeleton />
            <MissionSkeleton />
          </>
        ) : null}
        {staff?.canPick ? (
          <>
            <SectionHead title="À préparer" count={pickQueue.length} kind="pick" />
            {pickQueue.map((j) => (
              <MissionCard
                key={j.id}
                {...pickCardProps(j)}
                cta={j.pick_status === 'queued' ? (busy === j.id ? '…' : 'PRENDRE') : 'OUVRIR'}
                onPress={j.pick_status === 'queued' ? undefined : () => router.push(`/job/${encodeURIComponent(j.id)}`)}
                onAccept={() =>
                  j.pick_status === 'queued' ? void takePick(j.id) : router.push(`/job/${encodeURIComponent(j.id)}`)
                }
              />
            ))}
          </>
        ) : null}
        {staff?.canDeliver ? (
          <>
            <SectionHead title="À livrer" count={readyDel.length + mineDel.length} kind="deliver" />
            {readyDel.map((d) => (
              <MissionCard
                key={d.id}
                {...deliveryCardProps(d)}
                cta={busy === d.id ? '…' : 'PRENDRE'}
                onPress={() => void takeDel(d.id)}
                onAccept={() => void takeDel(d.id)}
              />
            ))}
            {mineDel.map((d) => (
              <MissionCard
                key={d.id}
                {...deliveryCardProps(d)}
                cta="SUIVRE"
                onPress={() => router.push(`/run/${encodeURIComponent(d.id)}`)}
                onAccept={() => router.push(`/run/${encodeURIComponent(d.id)}`)}
              />
            ))}
          </>
        ) : null}
        {empty && !refreshing ? (
          <Text style={styles.empty}>Aucune course ni livraison pour ce magasin.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, gap: 12 },
  empty: { ...bodyFont('400'), color: colors.muted, marginTop: 8 },
});
