import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

/** Ancien écran d’attente : le code se saisit désormais sur la course. */
export default function WaitScreen() {
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
