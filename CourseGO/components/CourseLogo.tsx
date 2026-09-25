import { Image, type ImageStyle, type StyleProp, type ViewStyle, View } from 'react-native';

const WORDMARK = require('../assets/images/coursego-logo.png');
const MARK = require('../assets/images/coursego-mark.png');

/** Wordmark ratio from asset (950×206). */
const WORDMARK_RATIO = 206 / 950;
const MARK_RATIO = 206 / 342;

export function CourseLogo({
  markOnly = false,
  width = 220,
  style,
  imageStyle,
}: {
  markOnly?: boolean;
  width?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}) {
  const ratio = markOnly ? MARK_RATIO : WORDMARK_RATIO;
  const height = Math.round(width * ratio);
  const source = markOnly ? MARK : WORDMARK;
  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]} accessibilityLabel="CourseGo">
      <Image source={source} style={[{ width, height }, imageStyle]} resizeMode="contain" />
    </View>
  );
}

export const courseGoMark = MARK;
export const courseGoWordmark = WORDMARK;
