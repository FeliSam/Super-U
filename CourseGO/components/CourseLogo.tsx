import { Image, type ImageStyle, type StyleProp, type ViewStyle, View } from 'react-native';

const WORDMARK = require('../assets/images/logo.jpg');
const MARK = require('../assets/images/icon.png');

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
  const height = markOnly ? width : Math.round(width * (855 / 1024));
  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]} accessibilityLabel="CourseGo">
      <Image
        source={markOnly ? MARK : WORDMARK}
        style={[{ width, height }, imageStyle]}
        resizeMode="contain"
      />
    </View>
  );
}

export const courseGoMark = MARK;
export const courseGoWordmark = WORDMARK;
