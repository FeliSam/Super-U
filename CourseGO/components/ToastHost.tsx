import { TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/constants/theme';
import { showToast, subscribeToasts, type ToastPayload, type ToastTone } from '@/lib/toastBus';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Item = ToastPayload & { id: string; exiting?: boolean };

const TONE: Record<ToastTone, { bg: string; border: string }> = {
  info: { bg: '#1A2A3A', border: '#3D5A73' },
  error: { bg: '#3A1616', border: '#8B2E2E' },
  success: { bg: '#163A22', border: '#2E8B4A' },
};

function ToastCard({ item, onGone }: { item: Item; onGone: (id: string) => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  useEffect(() => {
    if (!item.exiting) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 36, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onGone(item.id);
    });
  }, [item.exiting, item.id, opacity, translateY, onGone]);

  const tone = TONE[item.tone ?? 'info'];
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        onPress={() => {
          if (item.href) router.push(item.href as never);
          onGone(item.id);
        }}
        style={[styles.card, { backgroundColor: tone.bg, borderColor: tone.border }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
        </View>
        <Pressable
          onPress={() => onGone(item.id)}
          hitSlop={10}
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Item[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const gone = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, exiting: true } : x)));
  }, []);

  useEffect(() => {
    return subscribeToasts((payload) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: Item = { ...payload, id, tone: payload.tone ?? 'info' };
      setItems((prev) => [...prev.filter((x) => !x.exiting).slice(-2), item]);
      const ms = payload.durationMs ?? (payload.tone === 'error' ? 5200 : 3800);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ms),
      );
    });
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const bottom = TAB_BAR_HEIGHT + TAB_BAR_MARGIN + Math.max(insets.bottom, 8) + 8;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onGone={item.exiting ? gone : dismiss} />
      ))}
    </View>
  );
}

export function toastApiError(err: unknown) {
  const msg = err instanceof Error ? err.message : 'Une erreur est survenue.';
  if (/401|session|reconnecte/i.test(msg)) return;
  showToast({ title: 'Erreur', body: msg, tone: 'error' });
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  body: { color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 3 },
  close: { color: 'rgba(255,255,255,0.55)', fontSize: 14, paddingLeft: 4 },
});
