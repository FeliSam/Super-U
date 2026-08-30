import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

/** Ancien écran code : la remise se fait sur la course, en feuille. */
export default function ConfirmCodeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const delId = decodeURIComponent(id ?? '');

  useEffect(() => {
    if (!delId) {
      router.replace('/(tabs)/missions');
      return;
    }
    router.replace(`/run/${encodeURIComponent(delId)}`);
  }, [delId]);

  return <View />;
}
