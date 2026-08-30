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
import { getLocalDb } from '@/lib/db/client';
import { hydrateCatalogFromApi } from '@/lib/db/hydrateCatalog';
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
  const asset = Asset.fromModule(mod);
  return asset.localUri ?? asset.uri ?? null;
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
  if (modules.length) {
    await Asset.loadAsync(modules).catch(() => undefined);
  }
  const uris = [
    ...modules.map(assetUri).filter((u): u is string => Boolean(u)),
    ...extraUris,
  ];
  if (!uris.length) return;
  await Promise.all([
    ExpoImage.prefetch(uris, 'memory-disk').catch(() => undefined),
    decodeUris(uris, concurrency),
  ]);
}

async function preloadSources(sources: ImageSourcePropType[], concurrency: number) {
  await preloadModules(uniqueModules(sources), bundledUris(sources), concurrency);
}

function homeImageSources(): ImageSourcePropType[] {
  return [
    brandMark,
    mangoHero,
    promoBanner,
    ...homeCategories.map((c) => c.image),
    ...homePromoBanners.map((b) => b.image),
    ...products.slice(0, 12).map((p) => p.image),
  ];
}

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

let homeImagesReady = false;
let imagesReady = false;

/** Logo only — needed for the branded splash. */
async function preloadSplashMark() {
  await Asset.loadAsync(brandMark).catch(() => undefined);
}

/** First-screen images; does not wait for the full catalog. */
export async function preloadHomeImages(): Promise<void> {
  if (homeImagesReady) return;
  await preloadSources(homeImageSources(), 4);
  homeImagesReady = true;
}

/** Full catalog decode — run after first paint. */
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

/** SQLite + optional API catalog — never block first paint. */
function warmLocalData() {
  void getLocalDb();
  void hydrateCatalogFromApi();
}

let readyPromise: Promise<void> | null = null;

/**
 * First paint: fonts + splash mark only. Catalog, SQLite and the rest of the
 * images warm in the background.
 */
export function prepareApp(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      warmLocalData();
      const fonts = Promise.all([Font.loadAsync(iconFonts), loadBrandFonts()]).then(() => undefined);
      await Promise.race([
        Promise.all([fonts, preloadSplashMark()]),
        new Promise<void>((resolve) => setTimeout(resolve, 900)),
      ]);
      void preloadHomeImages();
    })().catch(() => undefined);
  }
  return readyPromise;
}

/** After splash: home images now, full catalog when the thread is idle. */
export function warmRemainingAssets(): void {
  void preloadHomeImages();
  scheduleIdle(() => {
    void preloadCatalogImages();
  });
}

export function hideSplash(): Promise<void> {
  return SplashScreen.hideAsync().catch(() => undefined);
}
