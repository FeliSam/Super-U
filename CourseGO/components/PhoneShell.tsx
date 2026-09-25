import { PHONE_MAX_WIDTH, colors } from '@/constants/theme';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

type Viewport = { width: number; height: number };

const ViewportContext = createContext<Viewport>({ width: PHONE_MAX_WIDTH, height: 800 });

export function useAppViewport() {
  return useContext(ViewportContext);
}

export function PhoneShell({ children }: { children: ReactNode }) {
  const win = useWindowDimensions();
  const [box, setBox] = useState<Viewport | null>(null);
  const viewport = box ?? {
    width: Platform.OS === 'web' ? Math.min(win.width, PHONE_MAX_WIDTH) : win.width,
    height: win.height,
  };
  const value = useMemo(() => viewport, [viewport.width, viewport.height]);

  if (Platform.OS !== 'web') {
    return <ViewportContext.Provider value={{ width: win.width, height: win.height }}>{children}</ViewportContext.Provider>;
  }

  return (
    <View style={styles.stage}>
      <View
        style={styles.phone}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (!width || !height) return;
          setBox((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
        }}>
        <ViewportContext.Provider value={value}>
          <View style={styles.fill}>{children}</View>
        </ViewportContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: PHONE_MAX_WIDTH,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  fill: { flex: 1, width: '100%', overflow: 'hidden', position: 'relative' },
  modalStage: {
    flex: 1,
    alignItems: 'center',
  },
  modalDim: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalPhone: {
    width: '100%',
    maxWidth: PHONE_MAX_WIDTH,
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalPhoneCenter: {
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalPhoneFill: {
    justifyContent: 'flex-start',
    position: 'relative',
  },
});

/** Cadre 430 px pour Modal RN Web (sinon la feuille s’étale sur tout l’écran). */
export function PhoneModalFrame({
  children,
  align = 'bottom',
  onDismiss,
}: {
  children: ReactNode;
  align?: 'bottom' | 'center' | 'fill';
  onDismiss?: () => void;
}) {
  return (
    <View style={styles.modalStage}>
      <Pressable style={[StyleSheet.absoluteFill, styles.modalDim]} onPress={onDismiss} />
      <View
        style={[
          styles.modalPhone,
          align === 'center' && styles.modalPhoneCenter,
          align === 'fill' && styles.modalPhoneFill,
        ]}
        pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}
