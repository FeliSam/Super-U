import { Href, router } from 'expo-router';

/** Change d’onglet sans empiler une route (préserve l’état des écrans). */
export function navigateTab(href: Href) {
  router.navigate(href);
}

/** Chemins courts des onglets — alignés sur le TabList. */
export const tabPaths = {
  home: '/',
  explore: '/explore',
  search: '/search',
  cart: '/cart',
  profile: '/profile',
} as const;
