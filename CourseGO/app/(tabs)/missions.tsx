import { AppHeader } from '@/components/AppHeader';
import { PullBanner, pullRefreshControl } from '@/components/PullRefresh';
import { ApiBanner } from '@/components/ApiBanner';
import { MissionCard, deliveryCardProps, pickCardProps } from '@/components/MissionCard';
import { MissionSkeleton } from '@/components/Skeleton';
import { SwipeRow } from '@/components/SwipeRow';
import { PillButton, Screen } from '@/components/ui';
import { bodyFont, colors, displayFont, radius } from '@/constants/theme';
import { useBoard } from '@/context/BoardContext';
import { useLocation } from '@/context/LocationContext';
import { useStaffAuth } from '@/context/StaffAuthContext';
import { useTabContentPadding } from '@/hooks/useTabContentPadding';
import { ApiError } from '@/lib/api/http';
import { claimDelivery, claimPick, releaseDelivery, startDeliveryRun } from '@/lib/api/ops';
import {
  isActivePickStatus,
  isDeliveryActive,
  isDeliveryClaimable,
  isDeliveryHeld,
  isDeliveryStarted,
  MAX_ACTIVE_DELIVERIES,
} from '@/lib/opsModel';
import { clearLastDropoff } from '@/lib/tourRoute';
import { sortBySlot } from '@/lib/slotKind';
import { livePosKey, sortNearStore, storeDistanceM, suggestedStore } from '@/lib/nearestStore';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Filter = 'all' | 'pick' | 'ongoing' | 'deliver';

export default function MissionsScreen() {
  const { staff } = useStaffAuth();
  const { jobs, deliveries, mapStores, refresh, refreshing, lastError } = useBoard();
  const { mapPosition } = useLocation();
  const pad = useTabContentPadding();
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const pickMine = useMemo(
    () =>
      sortBySlot(
        jobs.filter((j) => isActivePickStatus(j.pick_status) && j.picker_id === staff?.id),
      ),
    [jobs, staff?.id],
  );
  const mineDel = useMemo(
    () => sortBySlot(deliveries.filter((d) => isDeliveryActive(d) && d.courier_id === staff?.id)),
    [deliveries, staff?.id],
  );
  const lockedStoreId = pickMine[0]?.store_id ?? mineDel[0]?.store_id ?? null;
  const courierBusy = pickMine.length > 0 || mineDel.length > 0;
  const liveKey = livePosKey(mapPosition);
  const suggested = useMemo(
    () => (courierBusy ? null : suggestedStore(mapStores, mapPosition, lockedStoreId)),
    [courierBusy, mapStores, liveKey, lockedStoreId],
  );
  const distOf = useCallback(
    (storeId: string | null | undefined) =>
      storeDistanceM(
        mapStores.find((s) => s.id === storeId),
        mapPosition,
      ),
    [mapStores, liveKey],
  );
  const pickAvailable = useMemo(() => {
    const queued = jobs.filter((j) => j.pick_status === 'queued' && !j.picker_id);
    if (!suggested) return sortBySlot(queued);
    return sortNearStore(queued, suggested.id, distOf);
  }, [jobs, suggested, distOf]);
  const heldDel = useMemo(() => mineDel.filter(isDeliveryHeld), [mineDel]);
  const startedDel = useMemo(() => mineDel.filter(isDeliveryStarted), [mineDel]);
  const tourStarted = startedDel.length > 0;
  const coursesDel = heldDel;
  const readyDel = useMemo(() => {
    const ready = deliveries.filter((d) => isDeliveryClaimable(d) && !d.courier_id);
    if (!suggested) return sortBySlot(ready);
    return sortNearStore(ready, suggested.id, distOf);
  }, [deliveries, suggested, distOf]);
  const slotsLeft = Math.max(0, MAX_ACTIVE_DELIVERIES - mineDel.length);
  /** Ramassages actifs : visibles uniquement sur Maintenant, pas dans Courses. */
  const ongoingCount = coursesDel.length;

  const showPick = Boolean(staff?.canPick) && (filter === 'pick' || (filter === 'all' && pickAvailable.length > 0));
  const showOngoing = filter === 'ongoing' || (filter === 'all' && ongoingCount > 0);
  const showDel = Boolean(staff?.canDeliver) && (filter === 'deliver' || (filter === 'all' && readyDel.length > 0));
  const pickEmpty = filter === 'pick' && pickAvailable.length === 0;
  const ongoingEmpty = filter === 'ongoing' && ongoingCount === 0;
  const delEmpty = filter === 'deliver' && readyDel.length === 0;
  const boardEmpty = pickAvailable.length === 0 && readyDel.length === 0 && coursesDel.length === 0;
  const showStartBar = Boolean(staff?.canDeliver) && heldDel.length > 0 && !tourStarted;

  useFocusEffect(
    useCallback(() => {
      void refresh({ silent: true });
    }, [refresh]),
  );

  const fail = (title: string, e: unknown) => {
    Alert.alert(title, e instanceof ApiError ? e.message : (e as Error).message);
  };

  const takePick = async (id: string) => {
    setBusy(id);
    try {
      await claimPick(id);
      await refresh();
      router.push(`/job/${encodeURIComponent(id)}`);
    } catch (e) {
      fail('Course', e);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const addDel = async (id: string) => {
    if (tourStarted) {
      Alert.alert('Livraison', 'Tournée déjà démarrée. Terminez-la avant d’ajouter un colis.');
      return;
    }
    if (slotsLeft <= 0) {
      Alert.alert('Livraison', `Vous avez déjà ${MAX_ACTIVE_DELIVERIES} colis. Livrez-les avant d’en ajouter un autre.`);
      return;
    }
    setBusy(id);
    try {
      await claimDelivery(id);
      await refresh();
    } catch (e) {
      fail('Livraison', e);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const dropDel = async (id: string) => {
    setBusy(id);
    try {
      await releaseDelivery(id);
      await refresh();
    } catch (e) {
      fail('Livraison', e);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const startTour = async () => {
    setBusy('start');
    try {
      if (staff?.id) clearLastDropoff(staff.id);
      const res = await startDeliveryRun();
      await refresh();
      router.push(`/run/${encodeURIComponent(res.deliveryId)}`);
    } catch (e) {
      fail('Tournée', e);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'Tout', count: pickAvailable.length + ongoingCount + readyDel.length },
    { id: 'pick', label: 'À préparer', count: pickAvailable.length },
    { id: 'ongoing', label: 'En cours', count: ongoingCount },
    { id: 'deliver', label: 'À livrer', count: readyDel.length },
  ];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: pad + (showStartBar ? 72 : 0) }]}
        refreshControl={pullRefreshControl(refreshing, refresh)}>
        <PullBanner visible={refreshing} />
        <AppHeader
          title="Courses"
          subtitle="Glissez une carte pour les actions"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={styles.filtersScroll}>
          {filters.map((f) => {
            const on = filter === f.id;
            return (
              <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{f.label}</Text>
                <View style={[styles.chipCount, on && styles.chipCountOn]}>
                  <Text style={[styles.chipCountTxt, on && styles.chipCountTxtOn]}>{f.count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        {lastError ? <ApiBanner message={lastError} onRetry={() => void refresh()} /> : null}
        {refreshing && boardEmpty ? (
          <>
            <MissionSkeleton />
            <MissionSkeleton />
          </>
        ) : null}
        {filter === 'all' && boardEmpty && !refreshing ? (
          <EmptyBlock
            icon="shopping-bag"
            title="Aucune course"
            sub="Les commandes à préparer, en cours ou à livrer s’affichent ici."
          />
        ) : null}

        {showPick ? (
          <>
            {filter === 'all' ? <Text style={styles.section}>À préparer</Text> : null}
            <Text style={styles.hint}>
              {suggested
                ? `D’abord ${suggested.name} (${(suggested.distanceM / 1000).toFixed(1)} km)${suggested.waiting ? ` · ${suggested.waiting} en attente` : ''}. Un ramassage à la fois, max ${MAX_ACTIVE_DELIVERIES} colis.`
                : `Un ramassage à la fois. Après un colis, vous pouvez en prendre un autre dans le même Super U, jusqu’à ${MAX_ACTIVE_DELIVERIES} colis.`}
            </Text>
            {pickAvailable.map((j) => (
              <SwipeRow
                key={j.id}
                left={[
                  { key: 'take', label: 'Prendre', tone: 'teal', icon: 'check', onPress: () => void takePick(j.id) },
                ]}>
                <MissionCard
                  {...pickCardProps(j)}
                  nearest={Boolean(suggested?.id && j.store_id === suggested.id)}
                  distanceM={Number.isFinite(distOf(j.store_id)) ? distOf(j.store_id) : undefined}
                  cta={busy === j.id ? '…' : 'PRENDRE'}
                  onAccept={() => void takePick(j.id)}
                />
              </SwipeRow>
            ))}
            {pickEmpty && !refreshing ? (
              <EmptyBlock
                icon="shopping-bag"
                title="Rien à préparer"
                sub="Les nouvelles commandes du magasin apparaîtront ici, urgentes en premier."
              />
            ) : null}
          </>
        ) : null}

        {showDel ? (
          <>
            {filter === 'all' ? <Text style={styles.section}>À livrer</Text> : null}
            {readyDel.map((d) => {
              const locked = tourStarted || slotsLeft <= 0;
              return (
                <SwipeRow
                  key={d.id}
                  left={
                    locked
                      ? undefined
                      : [
                          {
                            key: 'add',
                            label: 'Ajouter',
                            tone: 'teal',
                            icon: 'plus',
                            onPress: () => void addDel(d.id),
                          },
                        ]
                  }>
                  <MissionCard
                    {...deliveryCardProps(d)}
                    nearest={Boolean(suggested?.id && d.store_id === suggested.id)}
                    distanceM={
                      d.route_distance_m ??
                      (Number.isFinite(distOf(d.store_id)) ? distOf(d.store_id) : undefined)
                    }
                    cta={
                      locked
                        ? tourStarted
                          ? 'EN COURS'
                          : `MAX ${MAX_ACTIVE_DELIVERIES}`
                        : busy === d.id
                          ? '…'
                          : 'AJOUTER'
                    }
                    onPress={() =>
                      locked
                        ? Alert.alert(
                            'Livraison',
                            tourStarted
                              ? 'Tournée démarrée. Terminez-la avant d’ajouter un colis.'
                              : `Vous avez déjà ${MAX_ACTIVE_DELIVERIES} colis. Livrez-les avant d’en ajouter un autre.`,
                          )
                        : void addDel(d.id)
                    }
                    onAccept={() =>
                      locked
                        ? Alert.alert(
                            'Livraison',
                            tourStarted
                              ? 'Tournée démarrée. Terminez-la avant d’ajouter un colis.'
                              : `Vous avez déjà ${MAX_ACTIVE_DELIVERIES} colis. Livrez-les avant d’en ajouter un autre.`,
                          )
                        : void addDel(d.id)
                    }
                  />
                </SwipeRow>
              );
            })}
            {delEmpty && !refreshing ? (
              <EmptyBlock
                icon="navigation"
                title="Rien à livrer"
                sub="Dès qu’un panier est prêt, la course s’affiche ici — Urgent, Rapide ou Planifiée."
              />
            ) : null}
          </>
        ) : null}

        {showOngoing ? (
          <>
            {filter === 'all' ? <Text style={styles.section}>En cours</Text> : null}
            {coursesDel.map((d) => {
              return (
                <SwipeRow
                  key={d.id}
                  left={[
                    {
                      key: 'go',
                      label: 'Voir',
                      tone: 'teal',
                      icon: 'navigation',
                      onPress: () => router.push(`/run/${encodeURIComponent(d.id)}`),
                    },
                  ]}
                  right={[
                    { key: 'drop', label: 'Retirer', tone: 'coral', icon: 'x', onPress: () => void dropDel(d.id) },
                  ]}>
                  <MissionCard
                    {...deliveryCardProps(d)}
                    selected
                    cta="SÉLECTIONNÉ"
                    onPress={() => router.push(`/run/${encodeURIComponent(d.id)}`)}
                    onAccept={() => router.push(`/run/${encodeURIComponent(d.id)}`)}
                  />
                </SwipeRow>
              );
            })}
            {ongoingEmpty && !refreshing ? (
              <EmptyBlock
                icon="clock"
                title="Aucune course en cours"
                sub="Les colis sélectionnés apparaissent ici. Le ramassage en cours est sur Maintenant."
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
      {showStartBar ? (
        <View style={[styles.startBar, { bottom: pad - 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.startKicker}>Tournée</Text>
            <Text style={styles.startTxt}>
              {heldDel.length} / {MAX_ACTIVE_DELIVERIES} colis
            </Text>
          </View>
          <View style={{ minWidth: 160 }}>
            <PillButton
              label={busy === 'start' ? '…' : 'Je démarre'}
              onPress={() => void startTour()}
              disabled={busy !== null}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function EmptyBlock({ icon, title, sub }: { icon: 'shopping-bag' | 'navigation' | 'clock'; title: string; sub: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={22} color={colors.teal} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, gap: 12 },
  filtersScroll: { flexGrow: 0, marginHorizontal: -24 },
  filters: { paddingHorizontal: 24, gap: 8, paddingBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipTxt: { ...bodyFont('700'), fontSize: 13, color: colors.muted },
  chipTxtOn: { color: colors.onAccent },
  chipCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCountOn: { backgroundColor: 'rgba(255,255,255,0.18)' },
  chipCountTxt: { ...bodyFont('800'), fontSize: 11, color: colors.muted },
  chipCountTxtOn: { color: colors.onAccent },
  section: {
    ...displayFont('800'),
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 4,
  },
  hint: { ...bodyFont('400'), fontSize: 13, color: colors.muted, marginTop: -4, marginBottom: 4 },
  startBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 12,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  startKicker: { ...displayFont('800'), fontSize: 11, letterSpacing: 0.6, color: colors.teal },
  startTxt: { ...bodyFont('700'), fontSize: 14, color: colors.text },
  empty: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...displayFont('800'), fontSize: 16, color: colors.text, textAlign: 'center' },
  emptySub: { ...bodyFont('400'), fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
});
