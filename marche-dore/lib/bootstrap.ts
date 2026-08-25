import {
  avatar,
  getProducts,
  homeCategories,
  homePromoBanners,
  popularIds,
  promoBanner,
} from '@/data/catalog';
import { loadBrandFonts } from '@/lib/fonts';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import type { ImageSourcePropType } from 'react-native';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

ExpoStatusBar.setHidden(true, 'none');
if (Platform.OS !== 'web') {
  RNStatusBar.setHidden(true, 'none');
}

const iconFonts = {
  ...Feather.font,
  ...Ionicons.font,
};

/** Only what the first home viewport needs — keep startup light. */
function criticalAssets(): ImageSourcePropType[] {
  return [
    ...getProducts(popularIds).map((p) => p.image),
    ...homeCategories.slice(0, 6).map((c) => c.image),
    homePromoBanners[0]?.image ?? promoBanner,
    avatar,
  ];
}

function uniqueModules(sources: ImageSourcePropType[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const src of sources) {
    if (typeof src === 'number' && !seen.has(src)) {
      seen.add(src);
      out.push(src);
    }
  }
  return out;
}

let readyPromise: Promise<void> | null = null;

/**
 * Block first paint on icon + brand fonts.
 * Critical images preload in parallel but never block longer than a short budget.
 */
export function prepareApp(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const fonts = Promise.all([Font.loadAsync(iconFonts), loadBrandFonts()]);
      const images = Asset.loadAsync(uniqueModules(criticalAssets())).catch(() => undefined);

      await fonts;

      // Don't stall splash on slow image I/O — race with a short timeout.
      await Promise.race([
        images,
        new Promise<void>((resolve) => setTimeout(resolve, 280)),
      ]);
    })().catch(() => undefined);
  }
  return readyPromise;
}

/** Warm remaining catalog images after the UI is already visible. */
export function warmRemainingAssets(): void {
  void import('@/data/catalog')
    .then(({ products, exploreCategories, searchCategories, homePromoBanners: banners, mangoHero }) => {
      const rest: ImageSourcePropType[] = [
        ...products.map((p) => p.image),
        ...exploreCategories.map((c) => c.image),
        ...searchCategories.map((c) => c.image),
        ...banners.map((b) => b.image),
        mangoHero,
      ];
      return Asset.loadAsync(uniqueModules(rest));
    })
    .catch(() => undefined);
}

export function hideSplash(): Promise<void> {
  return SplashScreen.hideAsync().catch(() => undefined);
}
