import { MarcheTabBar } from '@/components/MarcheTabBar';
import { colors as fallbackColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { Tabs, usePathname } from 'expo-router';
import { StyleSheet } from 'react-native';

const colors = fallbackColors;

const keepTabMounted = {
  lazy: false,
  freezeOnBlur: false,
} as const;

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
        lazy: false,
        freezeOnBlur: false,
        animation: 'none',
        tabBarHideOnKeyboard: true,
        tabBarStyle: { display: 'none' },
        sceneContainerStyle: [styles.scene, { backgroundColor: theme.bg }],
      }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', ...keepTabMounted }} />
      <Tabs.Screen name="explore" options={{ title: 'Explorer', ...keepTabMounted }} />
      <Tabs.Screen name="cart" options={{ title: 'Panier', ...keepTabMounted }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', ...keepTabMounted }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', ...keepTabMounted }} />
      <Tabs.Screen name="search" options={{ href: null, title: 'Rechercher', ...keepTabMounted }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
