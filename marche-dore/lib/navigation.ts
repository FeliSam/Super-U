import { Href, router } from 'expo-router';

/** Change d’onglet / route sans empiler inutilement. */
export function navigateTab(href: Href) {
  router.navigate(href);
}

/** Chemins principaux — recherche hors onglets, chat dans les tabs. */
export const tabPaths = {
  home: '/' as Href,
  explore: '/explore' as Href,
  search: '/search' as Href,
  promotions: '/promotions' as Href,
  cart: '/cart' as Href,
  chat: '/chat' as Href,
  profile: '/profile' as Href,
};
