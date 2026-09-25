/**
 * Boot helpers. Prefers static Expo imports (after `import 'expo'` in index.js).
 * Avoid Metro `import()` lazy chunks for expo-* — they break with
 * "Requiring unknown module NNN" on web after cache churn.
 */
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
import { BRAND_MARK } from '@/constants/brand';
import { getLocalDb } from '@/lib/db/client';
import { loadBrandFonts } from '@/lib/fonts';
import { downloadCategoryLocalArt, pinExploreCategoriesLocalArt } from '@/lib/categoryLocalArt';
import { Asset } from 'expo-asset';
import { Image as ExpoImage } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import type { ImageSourcePropType } from 'react-native';
import { Image as RNImage, Platform } from 'react-native';

let splashPrevented = false;

export async function prepareNativeSplash(): Promise<void> {
  if (splashPrevented) return;
  splashPrevented = true;
  try {
    await SplashScreen.preventAutoHideAsync();
  } catch {
    /* Expo Go / web */
  }
}

void prepareNativeSplash();

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

function bundledUris(sources: ImageSourcePropType[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of sources) {
    if (!src || typeof src === 'number' || typeof src === 'string' || Array.isArray(src)) continue;
    const uri = (src as { uri?: string }).uri;
    if (!uri || seen.has(uri)) continue;
    if (/\/catalog\/media\//i.test(uri)) continue;
    seen.add(uri);
    out.push(uri);
  }
  return out;
}

function assetUri(mod: number): string | null {
  try {
    const asset = Asset.fromModule(mod);
    return asset.localUri ?? asset.uri ?? null;
  } catch {
    return null;
  }
}

async function decodeUris(uris: string[], concurrency = 4) {
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
    await Promise.all(Array.from({ length: Math.min(concurrency, uris.length || 1) }, worker));
    return;
  }
  await Promise.all(uris.map((uri) => RNImage.prefetch(uri).catch(() => false)));
}

async function preloadModules(modules: number[], extraUris: string[], concurrency = 4) {
  try {
    if (modules.length) await Asset.loadAsync(modules).catch(() => undefined);
    const uris = [...modules.map(assetUri).filter((u): u is string => Boolean(u)), ...extraUris];
    if (!uris.length) return;
    await Promise.all([
      ExpoImage.prefetch(uris, 'memory-disk').catch(() => undefined),
      decodeUris(uris, concurrency),
    ]);
  } catch {
    /* ignore */
  }
}

async function preloadSources(sources: ImageSourcePropType[], concurrency: number) {
  await preloadModules(uniqueModules(sources), bundledUris(sources), concurrency);
}

function homeImageSources(): ImageSourcePropType[] {
  return [
    BRAND_MARK,
    mangoHero,
    promoBanner,
    ...homeCategories.map((c) => c.image),
    ...homePromoBanners.map((b) => b.image),
    ...products.slice(0, 12).map((p) => p.image),
  ];
}

function allImageSources(): ImageSourcePropType[] {
  return [
    BRAND_MARK,
    avatar,
    mangoHero,
    promoBanner,
    ...products.slice(0, 24).map((p) => p.image),
    ...exploreCategories.map((c) => c.image),
    ...searchCategories.map((c) => c.image),
    ...homeCategories.map((c) => c.image),
    ...homePromoBanners.map((b) => b.image),
  ];
}

let homeImagesReady = false;
let imagesReady = false;

export async function preloadHomeImages(): Promise<void> {
  if (homeImagesReady) return;
  await preloadSources(homeImageSources(), 4);
  homeImagesReady = true;
}

export async function preloadCatalogImages(): Promise<void> {
  if (imagesReady) return;
  await preloadSources(allImageSources(), Platform.OS === 'web' ? 2 : 6);
  imagesReady = true;
  homeImagesReady = true;
}

function scheduleIdle(task: () => void) {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void })
    .requestIdleCallback;
  if (typeof ric === 'function') {
    ric(task, { timeout: 2500 });
    return;
  }
  setTimeout(task, 400);
}

let readyPromise: Promise<void> | null = null;

export function prepareApp(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      void getLocalDb().catch(() => undefined);
      await Promise.race([
        loadBrandFonts().catch(() => undefined),
        new Promise<void>((r) => setTimeout(r, 800)),
      ]);
      await Asset.loadAsync(BRAND_MARK).catch(() => undefined);
      pinExploreCategoriesLocalArt(exploreCategories);
      void downloadCategoryLocalArt();
      void preloadHomeImages();
    })().catch(() => undefined);
  }
  return readyPromise;
}

export function warmRemainingAssets(): void {
  void preloadHomeImages();
  scheduleIdle(() => {
    void preloadCatalogImages();
  });
}

export async function hideSplash(): Promise<void> {
  try {
    await SplashScreen.hideAsync();
  } catch {
    /* already hidden */
  }
}
