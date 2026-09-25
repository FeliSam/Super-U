import { bodyFont, displayFont, type AppColors } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { getBootFatal, subscribeBootFatal } from '@/lib/launchGuards';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Affiche la dernière erreur fatale si React a quand même pu monter. */
export function BootFatalHost() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [fatal, setFatal] = useState(getBootFatal);

  useEffect(() => subscribeBootFatal(setFatal), []);

  if (!fatal) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.kicker}>Erreur visible</Text>
        <Text style={styles.title}>L’app a planté au démarrage</Text>
        <ScrollView style={styles.scroll} nestedScrollEnabled>
          <Text style={styles.msg} selectable>
            {fatal.message}
          </Text>
          {fatal.stack ? (
            <Text style={styles.stack} selectable>
              {fatal.stack}
            </Text>
          ) : null}
        </ScrollView>
        <Pressable onPress={() => setFatal(null)} style={styles.btn}>
          <Text style={styles.btnTxt}>Masquer</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 99999,
      justifyContent: 'center',
      padding: 16,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: 16,
      padding: 16,
      gap: 10,
      maxHeight: '80%',
      borderWidth: 1,
      borderColor: colors.terracotta,
    },
    kicker: {
      ...displayFont('800'),
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.terracotta,
    },
    title: { ...displayFont('800'), fontSize: 18, color: colors.text },
    scroll: { maxHeight: 220 },
    msg: { ...bodyFont('600'), fontSize: 14, color: colors.text, lineHeight: 20 },
    stack: {
      ...bodyFont('400'),
      fontSize: 11,
      color: colors.muted,
      marginTop: 8,
      fontFamily: PlatformSelectMono,
    },
    btn: {
      alignSelf: 'flex-end',
      backgroundColor: colors.gold,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
    },
    btnTxt: { ...displayFont('800'), fontSize: 13, color: '#fff' },
  });
}

const PlatformSelectMono = 'Courier';
