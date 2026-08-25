import { Screen, Page } from '@/components/ui';
import { MotionView, PressScale } from '@/components/motion';
import { displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { formatOrderId, useOrders } from '@/context/OrdersContext';
import { formatFcfa } from '@/lib/format';
import { Feather } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REDIRECT_MS = 3000;

export default function OrderSuccessScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getOrder, activeOrder } = useOrders();
  const order = (id ? getOrder(id) : null) ?? activeOrder;
  const [remaining, setRemaining] = useState(3);
  const progress = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0.4)).current;
  const redirected = useRef(false);

  const goTracking = () => {
    if (redirected.current) return;
    redirected.current = true;
    const orderId = typeof id === 'string' && id ? id : order?.id;
    const href = (orderId ? `/tracking?id=${orderId}` : '/tracking') as Href;
    router.replace(href);
  };

  useEffect(() => {
    Animated.spring(checkScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 10,
    }).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: REDIRECT_MS,
      useNativeDriver: false,
    }).start();

    const tick = setInterval(() => {
      setRemaining((s) => Math.max(0, s - 1));
    }, 1000);

    const timer = setTimeout(goTracking, REDIRECT_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const slotLabel = order ? `${order.dayLabel} · ${order.slotLabel}` : 'le créneau choisi';

  return (
    <Screen>
      <Page style={styles.flex}>
        <View style={[styles.wrap, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}>
          <MotionView preset="zoom" delay={40}>
            <Animated.View style={[styles.iconWrap, { transform: [{ scale: checkScale }] }]}>
              <View style={styles.iconRing}>
                <Feather name="check" size={36} color={colors.onAccent} />
              </View>
            </Animated.View>
          </MotionView>

          <MotionView preset="up" delay={120}>
            <Text style={styles.title}>Commande approuvée</Text>
          </MotionView>

          <MotionView preset="up" delay={180}>
            <Text style={styles.message}>
              Votre commande a bien été validée. Elle vous sera livrée dans le délai indiqué :
            </Text>
            <Text style={styles.slot}>{slotLabel}</Text>
          </MotionView>

          {order ? (
            <MotionView preset="up" delay={240}>
              <View style={styles.metaCard}>
                <Text style={styles.metaId}>{formatOrderId(order.id)}</Text>
                <Text style={styles.metaTotal}>{formatFcfa(order.total)}</Text>
              </View>
            </MotionView>
          ) : null}

          <MotionView preset="fade" delay={320} style={styles.redirectBlock}>
            <Text style={styles.redirect}>
              Redirection vers le suivi{remaining > 0 ? ` dans ${remaining} s` : '…'}
            </Text>
            <View style={styles.track}>
              <Animated.View style={[styles.fill, { width: barWidth }]} />
            </View>
            <PressScale style={styles.skipBtn} onPress={goTracking} scaleTo={0.97}>
              <Text style={styles.skipText}>Voir le suivi maintenant</Text>
              <Feather name="arrow-right" size={15} color={colors.gold} />
            </PressScale>
          </MotionView>
        </View>
      </Page>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    wrap: {
      flex: 1,
      paddingHorizontal: 28,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    iconWrap: { marginBottom: 12, alignItems: 'center' },
    iconRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: colors.text,
      fontSize: 26,
      textAlign: 'center',
      letterSpacing: -0.3,
      ...displayFont('800'),
    },
    message: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      maxWidth: 320,
    },
    slot: {
      color: colors.gold,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: 4,
    },
    metaCard: {
      marginTop: 12,
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 18,
      alignItems: 'center',
      gap: 4,
      minWidth: 200,
    },
    metaId: { color: colors.text, fontSize: 14, fontWeight: '700' },
    metaTotal: { color: colors.terracotta, fontSize: 16, fontWeight: '800' },
    redirectBlock: { alignItems: 'center', width: '100%', marginTop: 16, gap: 10 },
    redirect: {
      color: colors.placeholder,
      fontSize: 13,
      fontWeight: '600',
    },
    track: {
      width: '70%',
      maxWidth: 240,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      backgroundColor: colors.gold,
      borderRadius: 2,
    },
    skipBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      minHeight: 44,
    },
    skipText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  });
}
