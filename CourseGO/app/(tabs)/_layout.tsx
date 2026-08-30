import { CourseTabBar } from '@/components/TabItem';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      detachInactiveScreens={false}
      tabBar={(props) => <CourseTabBar {...(props as unknown as Parameters<typeof CourseTabBar>[0])} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        animation: Platform.OS === 'web' ? 'none' : 'fade',
        freezeOnBlur: false,
      }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="missions" />
      <Tabs.Screen name="earnings" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
