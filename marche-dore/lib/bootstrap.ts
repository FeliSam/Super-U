import {
  avatar,
  exploreCategories,
  homeCategories,
  homePromoBanners,
  mangoHero,
  products,
  promoBanner,
  searchCategories,
} from '@/data/catalog';
import { loadBrandFonts } from '@/lib/fonts';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { Image as ExpoImage } from 'expo-image';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import type { ImageSourcePropType } from 'react-native';
import { Image as RNImage, Platform, StatusBar as RNStatusBar } from 'react-native';
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

const brandMark = require('../assets/images/brand-mark.png') as number;

function allImageSources(): ImageSourcePropType[] {
  return [
    brandMark,
    avatar,
    mangoHero,
    promoBanner,
    ...products.map((p) => p.image),
    ...exploreCategories.map((c) => c.image),
    ...searchCategories.map((c) => c.image),
    ...homeCategories.map((c) => c.image),
    ...homePromoBanners.map((b) => b.image),
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

function assetUri(mod: number): string | null {
  const asset = Asset.fromModule(mod);
  return asset.localUri ?? asset.uri ?? null;
}

async function decodeUris(uris: string[]) {
  if (Platform.OS === 'web' && typeof globalThis.Image !== 'undefined') {
    const pending = [...uris];
    const worker = async () => {
      while (pending.length) {
        const uri = pending.shift();
        if (!uri) return;
        await new Promise<void>((resolve) => {
          const img = new globalThis.Image();
          img.decoding = 'async';
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = uri;
        });
      }
    };
    await Promise.all(Array.from({ length: Math.min(10, uris.length || 1) }, worker));
    return;
  }

  await Promise.all(uris.map((uri) => RNImage.prefetch(uri).catch(() => false)));
}

let imagesReady = false;

/** Download + decode every catalog image so screens paint from cache. */
export async function preloadCatalogImages(): Promise<void> {
  if (imagesReady) return;
  const modules = uniqueModules(allImageSources());
  await Asset.loadAsync(modules);

  const uris = modules.map(assetUri).filter((u): u is string => Boolean(u));
      await Promise.all([
        ExpoImage.prefetch(uris, 'memory-disk').catch(() => undefined),
        decodeUris(uris),
      ]);
  imagesReady = true;
}

let readyPromise: Promise<void> | null = null;

/**
 * Block first paint until fonts and catalog images are in cache.
 */
export function prepareApp(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await Promise.all([Font.loadAsync(iconFonts), loadBrandFonts()]);
      await Promise.race([
        preloadCatalogImages(),
        new Promise<void>((resolve) => setTimeout(resolve, 12_000)),
      ]);
    })().catch(() => undefined);
  }
  return readyPromise;
}

/** Idempotent — safe after splash; images are already cached if prepareApp finished. */
export function warmRemainingAssets(): void {
  void preloadCatalogImages();
}

export function hideSplash(): Promise<void> {
  return SplashScreen.hideAsync().catch(() => undefined);
}
