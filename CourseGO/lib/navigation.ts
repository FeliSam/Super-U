import { Href, router } from 'expo-router';

/** Retour si possible, sinon écran de secours (évite GO_BACK non géré). */
export function goBack(fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}

export const authPaths = {
  login: '/(auth)/login' as Href,
  register: '/(auth)/register' as Href,
};

export const tabPaths = {
  home: '/(tabs)' as Href,
  missions: '/(tabs)/missions' as Href,
  history: '/(tabs)/history' as Href,
  earnings: '/(tabs)/earnings' as Href,
  profile: '/(tabs)/profile' as Href,
};
