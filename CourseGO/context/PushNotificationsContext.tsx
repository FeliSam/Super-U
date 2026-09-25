import { registerCommsDevice } from '@/lib/api/comms';
import { showToast } from '@/lib/toastBus';
import { useStaffAuth } from '@/context/StaffAuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

type Value = {
  ready: boolean;
  expoPushToken: string | null;
  registerDevice: () => Promise<boolean>;
};

const Ctx = createContext<Value | null>(null);

const TOKEN_KEY = 'coursego.pushToken.v1';

function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

function projectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    undefined
  );
}

type NotificationsMod = typeof import('expo-notifications');

async function loadNotifications(): Promise<NotificationsMod | null> {
  if (Platform.OS === 'web' || isExpoGo()) return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export function PushNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { staff } = useStaffAuth();
  const [ready, setReady] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const subs = useRef<{ remove: () => void }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const Notifications = await loadNotifications();
      if (cancelled || !Notifications) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const registerDevice = useCallback(async () => {
    if (Platform.OS === 'web' || isExpoGo()) return false;
    const Notifications = await loadNotifications();
    if (!Notifications) return false;
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'CourseGo',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#058d81',
        });
      }
      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== 'granted') {
        const asked = await Notifications.requestPermissionsAsync();
        status = asked.status;
      }
      if (status !== 'granted') return false;

      const pid = projectId();
      const tokenRes = pid
        ? await Notifications.getExpoPushTokenAsync({ projectId: pid })
        : await Notifications.getExpoPushTokenAsync();
      const pushToken = tokenRes.data;
      setExpoPushToken(pushToken);
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      await registerCommsDevice(platform, pushToken);
      await AsyncStorage.setItem(TOKEN_KEY, pushToken).catch(() => undefined);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    subs.current.forEach((s) => s.remove());
    subs.current = [];

    const run = async () => {
      setReady(false);
      if (isExpoGo() || Platform.OS === 'web') {
        if (mounted) setReady(true);
        return;
      }
      if (!staff) {
        setExpoPushToken(null);
        if (mounted) setReady(true);
        return;
      }

      try {
        const Notifications = await loadNotifications();
        if (!Notifications) {
          if (mounted) setReady(true);
          return;
        }
        const perm = await Notifications.getPermissionsAsync();
        if (perm.granted || perm.status === 'granted') {
          await registerDevice();
        }

        const sub1 = Notifications.addNotificationReceivedListener((n) => {
          showToast({
            title: String(n.request.content.title ?? 'Notification'),
            body: String(n.request.content.body ?? ''),
            tone: 'info',
          });
        });
        const sub2 = Notifications.addNotificationResponseReceivedListener((res) => {
          const href = res.notification.request.content.data?.href;
          if (typeof href === 'string' && href) void router.push(href as never);
        });
        subs.current = [sub1, sub2];
      } catch {
        /* Expo Go / missing projectId */
      } finally {
        if (mounted) setReady(true);
      }
    };

    void run();
    return () => {
      mounted = false;
      subs.current.forEach((s) => s.remove());
      subs.current = [];
    };
  }, [staff, registerDevice]);

  const value = useMemo(
    () => ({ ready, expoPushToken, registerDevice }),
    [ready, expoPushToken, registerDevice],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePushNotifications() {
  const v = useContext(Ctx);
  if (!v) throw new Error('PushNotificationsProvider missing');
  return v;
}
