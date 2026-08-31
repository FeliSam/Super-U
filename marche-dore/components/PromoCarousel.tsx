import { PromoBanner } from '@/components/ui';
import { useColors } from '@/context/ThemeContext';
import type { HomePromoBanner } from '@/data/catalog';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

const GAP = 10;
const INTERVAL_MS = 4200;

export function PromoCarousel({ banners, width }: { banners: HomePromoBanner[]; width: number }) {
  const colors = useColors();
  const ref = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const dragging = useRef(false);
  const [page, setPage] = useState(0);
  const step = width + GAP;

  const go = useCallback(
    (i: number, animated = true) => {
      if (!banners.length) return;
      const next = ((i % banners.length) + banners.length) % banners.length;
      indexRef.current = next;
      setPage(next);
      ref.current?.scrollTo({ x: next * step, animated });
    },
    [banners.length, step],
  );

  useEffect(() => {
    if (banners.length < 2) return;
    const id = setInterval(() => {
      if (dragging.current) return;
      go(indexRef.current + 1);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [banners.length, go]);

  if (!banners.length) return null;

  return (
    <View style={{ width, maxWidth: '100%', alignSelf: 'center' }}>
      <ScrollView
        ref={ref}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={step}
        snapToAlignment="start"
        disableIntervalMomentum
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          dragging.current = false;
          const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(step, 1));
          indexRef.current = Math.min(Math.max(i, 0), banners.length - 1);
          setPage(indexRef.current);
        }}
        scrollEventThrottle={16}>
        {banners.map((banner, i) => (
          <View key={banner.id} style={{ width, marginRight: i === banners.length - 1 ? 0 : GAP }}>
            <PromoBanner
              title={banner.title}
              subtitle={banner.subtitle}
              cta={banner.cta}
              image={banner.image}
              width={width}
              index={0}
              onPress={() => router.push(banner.href)}
            />
          </View>
        ))}
      </ScrollView>
      {banners.length > 1 ? (
        <View style={styles.dots}>
          {banners.map((banner, i) => (
            <View
              key={banner.id}
              style={[
                styles.dot,
                { backgroundColor: i === page ? colors.gold : colors.border },
                i === page ? styles.dotOn : null,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOn: {
    width: 16,
  },
});
