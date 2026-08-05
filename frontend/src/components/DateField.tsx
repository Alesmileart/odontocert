import React, { useMemo, useState } from "react";
import { View, StyleSheet, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/it";
import { AppText } from "@/src/components/ui";
import { colors, fontSize, spacing, radius, shadow } from "@/src/theme";

dayjs.extend(customParseFormat);
dayjs.locale("it");

const FMT = "DD/MM/YYYY";
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function parse(value?: string) {
  if (!value) return null;
  const d = dayjs(value, FMT, true);
  return d.isValid() ? d : null;
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = "GG/MM/AAAA",
  testID,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const [viewMonth, setViewMonth] = useState(() => selected || dayjs());

  const grid = useMemo(() => {
    const start = viewMonth.startOf("month");
    const offset = (start.day() + 6) % 7; // Monday-first
    const daysInMonth = viewMonth.daysInMonth();
    const cells: (dayjs.Dayjs | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(viewMonth.date(d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const openPicker = () => {
    setViewMonth(selected || dayjs());
    setOpen(true);
  };

  const pick = (d: dayjs.Dayjs) => {
    onChange(d.format(FMT));
    setOpen(false);
  };

  const today = dayjs();

  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="medium" size={fontSize.sm} color={colors.onSurfaceSecondary} style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <Pressable style={styles.input} onPress={openPicker} testID={testID}>
        <AppText size={fontSize.lg} color={value ? colors.onSurface : colors.muted}>
          {value || placeholder}
        </AppText>
        <Ionicons name="calendar-outline" size={20} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropTap} onPress={() => setOpen(false)} testID="date-backdrop" />
          <View style={[styles.card, { marginBottom: insets.bottom + spacing.xl }]}>
            <View style={styles.calHeader}>
              <Pressable onPress={() => setViewMonth((m) => m.subtract(1, "month"))} hitSlop={10} testID="cal-prev">
                <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
              </Pressable>
              <AppText variant="semibold" size={fontSize.lg}>
                {viewMonth.format("MMMM YYYY").replace(/^./, (c) => c.toUpperCase())}
              </AppText>
              <Pressable onPress={() => setViewMonth((m) => m.add(1, "month"))} hitSlop={10} testID="cal-next">
                <Ionicons name="chevron-forward" size={22} color={colors.onSurface} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <View key={w} style={styles.cell}>
                  <AppText size={fontSize.sm} color={colors.muted}>
                    {w}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {grid.map((d, i) => {
                if (!d) return <View key={i} style={styles.cell} />;
                const isSel = selected && d.isSame(selected, "day");
                const isToday = d.isSame(today, "day");
                return (
                  <Pressable key={i} style={styles.cell} onPress={() => pick(d)} testID={`cal-day-${d.date()}`}>
                    <View style={[styles.dayInner, isSel && styles.daySel, !isSel && isToday && styles.dayToday]}>
                      <AppText
                        variant={isSel ? "bold" : "regular"}
                        size={fontSize.base}
                        color={isSel ? colors.onBrandPrimary : colors.onSurface}
                      >
                        {d.date()}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.calFooter}>
              <Pressable onPress={() => pick(today)} testID="cal-today">
                <AppText variant="semibold" size={fontSize.base} color={colors.brandPrimary}>
                  Oggi
                </AppText>
              </Pressable>
              {value ? (
                <Pressable onPress={() => { onChange(""); setOpen(false); }} testID="cal-clear">
                  <AppText variant="semibold" size={fontSize.base} color={colors.error}>
                    Cancella
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs },
  input: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  backdrop: { flex: 1, justifyContent: "center", backgroundColor: "rgba(17,20,18,0.45)" },
  backdropTap: { ...StyleSheet.absoluteFillObject },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  calHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  weekRow: { flexDirection: "row", marginBottom: spacing.xs },
  daysGrid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayInner: { width: 38, height: 38, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  daySel: { backgroundColor: colors.brandPrimary },
  dayToday: { borderWidth: 1, borderColor: colors.borderStrong },
  calFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
});
