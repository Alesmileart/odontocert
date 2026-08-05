import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { AppText } from "@/src/components/ui";
import { colors, fontSize, spacing, radius } from "@/src/theme";

export const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

function ToothRow({
  row,
  selected,
  onToggle,
}: {
  row: number[];
  selected: number[];
  onToggle: (t: number) => void;
}) {
  return (
    <View style={styles.row}>
      {row.map((t, i) => {
        const active = selected.includes(t);
        return (
          <Pressable
            key={t}
            onPress={() => onToggle(t)}
            style={[styles.tooth, active && styles.toothActive, i === 8 && styles.midGap]}
            testID={`tooth-${t}`}
          >
            <AppText
              variant={active ? "bold" : "mono"}
              size={11}
              color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary}
            >
              {t}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToothChart({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (teeth: number[]) => void;
}) {
  const toggle = (t: number) => {
    if (selected.includes(t)) onChange(selected.filter((x) => x !== t));
    else onChange([...selected, t]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <AppText size={fontSize.sm} color={colors.muted}>
          Arcata superiore
        </AppText>
        {selected.length > 0 ? (
          <Pressable onPress={() => onChange([])} testID="clear-teeth">
            <AppText variant="semibold" size={fontSize.sm} color={colors.brandPrimary}>
              Azzera
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <ToothRow row={UPPER_TEETH} selected={selected} onToggle={toggle} />
      <View style={styles.divider} />
      <ToothRow row={LOWER_TEETH} selected={selected} onToggle={toggle} />
      <AppText size={fontSize.sm} color={colors.muted} style={{ marginTop: spacing.sm }}>
        Arcata inferiore
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 3 },
  tooth: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  toothActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  midGap: { marginLeft: 10 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
});
