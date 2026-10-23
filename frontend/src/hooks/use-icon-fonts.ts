// Icon font loader for Expo apps. Fonts are loaded from a CDN only under
// Expo Go (StoreClient) — where bundled .ttf assets may resolve as 0 bytes
// on Android. Native dev/prod builds and web pass an empty map, so useFonts
// resolves to [true, null] immediately.
// ICON_VECTOR_VERSION must match @react-native-vector-icons/ionicons in package.json.
// Usage: const [loaded, error] = useIconFonts();

import Constants, { ExecutionEnvironment } from "expo-constants";
import { useFonts } from "expo-font";

const ICON_VECTOR_VERSION = "14.0.0";

const iconFontMap = (): Record<string, string> => ({
  Ionicons: `https://cdn.jsdelivr.net/npm/@react-native-vector-icons/ionicons@${ICON_VECTOR_VERSION}/fonts/Ionicons.ttf`,
});

export const useIconFonts = (): readonly [boolean, Error | null] =>
  useFonts(
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      ? iconFontMap()
      : {},
  );
