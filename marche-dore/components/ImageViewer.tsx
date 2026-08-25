import { AppImage } from '@/components/AppImage';
import { ImagePager, type ImagePagerHandle } from '@/components/ImagePager';
import { PressScale } from '@/components/motion';
import { Feather } from '@expo/vector-icons';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  images: ImageSourcePropType[];
  initialIndex?: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
};

/** Fullscreen product image viewer with pager + thumbnail strip. */
export const ImageViewer = memo(function ImageViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
  onIndexChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const styles = useMemo(() => createStyles(), []);
  const pagerRef = useRef<ImagePagerHandle>(null);
  const thumbsRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(initialIndex);

  const pageW = Math.min(width, 430);
  const pageH = Math.min(height * 0.62, pageW * 1.15);

  useEffect(() => {
    if (!visible) return;
    const next = Math.max(0, Math.min(images.length - 1, initialIndex));
    setIndex(next);
    requestAnimationFrame(() => pagerRef.current?.goTo(next));
  }, [visible, initialIndex, images.length]);

  useEffect(() => {
    if (!visible || images.length <= 1) return;
    thumbsRef.current?.scrollTo({
      x: Math.max(0, index * 68 - pageW / 2 + 34),
      animated: true,
    });
  }, [index, visible, images.length, pageW]);

  const handleIndex = (next: number) => {
    setIndex(next);
    onIndexChange?.(next);
  };

  const goTo = (next: number) => {
    pagerRef.current?.goTo(next);
    handleIndex(next);
  };

  if (images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <Text style={styles.counter}>
            {index + 1} / {images.length}
          </Text>
          <PressScale
            onPress={onClose}
            scaleTo={0.9}
            style={styles.closeBtn}
            accessibilityLabel="Fermer le viewer">
            <Feather name="x" size={22} color="#ffffff" />
          </PressScale>
        </View>

        <View style={styles.stage} pointerEvents="box-none">
          <ImagePager
            ref={pagerRef}
            images={images}
            width={pageW}
            height={pageH}
            recyclingKeyPrefix="viewer"
            onIndexChange={handleIndex}
            style={styles.pager}
          />
        </View>

        {images.length > 1 ? (
          <View style={[styles.thumbsWrap, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
            <ScrollView
              ref={thumbsRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbs}>
              {images.map((src, i) => {
                const on = i === index;
                return (
                  <PressScale
                    key={`viewer-thumb-${i}`}
                    onPress={() => goTo(i)}
                    scaleTo={0.94}
                    style={[styles.thumb, on && styles.thumbOn]}
                    accessibilityLabel={`Image ${i + 1}`}>
                    <AppImage
                      source={src}
                      recyclingKey={Platform.OS === 'web' ? undefined : `viewer-t-${i}`}
                      frameStyle={styles.thumbImg}
                    />
                  </PressScale>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={{ height: Math.max(16, insets.bottom + 12) }} />
        )}
      </View>
    </Modal>
  );
});

function createStyles() {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: 'rgba(10,8,7,0.94)',
      justifyContent: 'space-between',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      zIndex: 2,
    },
    counter: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 14,
      fontWeight: '700',
    },
    closeBtn: {
      width: 42,
      height: 42,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
    },
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pager: {
      borderRadius: 18,
      overflow: 'hidden',
    },
    thumbsWrap: {
      paddingTop: 8,
    },
    thumbs: {
      gap: 10,
      paddingHorizontal: 18,
      alignItems: 'center',
    },
    thumb: {
      width: 58,
      height: 58,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    thumbOn: {
      borderColor: '#e2931d',
    },
    thumbImg: {
      width: '100%',
      height: '100%',
    },
  });
}
