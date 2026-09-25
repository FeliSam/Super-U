import { MarcheTabBar } from '@/components/MarcheTabBar';
import { colors as fallbackColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { Tabs, usePathname } from 'expo-router';
import { StyleSheet } from 'react-native';

const colors = fallbackColors;

const homeTab = { lazy: false, freezeOnBlur: false } as const;
/** Explorer / panier : ne pas geler — FlatList + freezeOnBlur = écran blanc au retour d’onglet. */
const liveTab = { lazy: false, freezeOnBlur: false } as const;
const spareTab = { lazy: true, freezeOnBlur: true } as const;

function isChatConversation(pathname: string) {
  return pathname.startsWith('/chat/') && pathname !== '/chat/';
}

export default function TabLayout() {
  const pathname = usePathname();
  const theme = useColors();
  const hideTabBar = isChatConversation(pathname);

  return (
    <Tabs
      detachInactiveScreens={false}
      backBehavior="history"
      tabBar={(props) => <MarcheTabBar {...props} hidden={hideTabBar} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        animation: 'fade',
        animationDuration: 180,
        tabBarHideOnKeyboard: true,
        tabBarStyle: { display: 'none' },
        sceneContainerStyle: [styles.scene, { backgroundColor: theme.bg }],
      }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', ...homeTab }} />
      <Tabs.Screen name="explore" options={{ title: 'Explorer', ...liveTab }} />
      <Tabs.Screen name="cart" options={{ title: 'Panier', ...liveTab }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', ...spareTab }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', ...spareTab }} />
      <Tabs.Screen name="search" options={{ href: null, title: 'Rechercher', ...spareTab }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    minWidth: 0,
    minHeight: 0,
  },
});
