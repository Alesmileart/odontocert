import React from "react";
import {
  Text,
  TextProps,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
} from "react-native";
import { colors, fonts, fontSize, radius, spacing, shadow } from "@/src/theme";

/* ---------------- Text ---------------- */
type Variant = "regular" | "medium" | "semibold" | "bold" | "mono" | "monoBold";
export function AppText({
  variant = "regular",
  size = fontSize.base,
  color = colors.onSurface,
  style,
  ...rest
}: TextProps & { variant?: Variant; size?: number; color?: string }) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: fonts[variant], fontSize: size, color }, style]}
    />
  );
}

/* ---------------- Button ---------------- */
type BtnKind = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  title,
  onPress,
  kind = "primary",
  loading,
  disabled,
  icon,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  kind?: BtnKind;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const bg =
    kind === "primary"
      ? colors.brandPrimary
      : kind === "danger"
      ? colors.error
      : kind === "secondary"
      ? colors.brandSecondary
      : "transparent";
  const fg =
    kind === "primary" || kind === "danger"
      ? colors.onBrandPrimary
      : colors.brandPrimary;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1 },
        kind === "ghost" && { borderWidth: 0 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon}
          <AppText variant="semibold" size={fontSize.lg} color={fg}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

/* ---------------- Card ---------------- */
export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    issued: { bg: colors.brandSecondary, fg: colors.success, label: "Emessa" },
    draft: { bg: colors.surfaceTertiary, fg: colors.muted, label: "Bozza" },
  };
  const s = map[status] || map.draft;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <AppText variant="semibold" size={fontSize.sm} color={s.fg}>
        {s.label}
      </AppText>
    </View>
  );
}

/* ---------------- Divider ---------------- */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.divider }, style]} />;
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.soft,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
});

export { colors, fonts, fontSize, radius, spacing, shadow };
export type { TextStyle };
