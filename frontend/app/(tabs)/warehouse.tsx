import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { AppText, Card, Button } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { FormSheet } from "@/src/components/FormSheet";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { colors, fontSize, spacing, radius } from "@/src/theme";

type Material = {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  track_stock: boolean;
  unit: string;
  stock: number;
  min_stock: number;
  location: string;
};

export default function Warehouse() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<Material | null>(null);
  const [mode, setMode] = useState<"load" | "unload">("load");
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    try {
      const m = await api.get<Material[]>("/materials");
      setMaterials(m);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const tracked = useMemo(() => materials.filter((m) => m.track_stock), [materials]);
  const lowCount = useMemo(() => tracked.filter((m) => (m.stock ?? 0) <= (m.min_stock ?? 0)).length, [tracked]);

  const openAdjust = (m: Material, m2: "load" | "unload") => {
    setActive(m);
    setMode(m2);
    setAmount("");
    setSheetOpen(true);
  };

  const confirmAdjust = async () => {
    if (!active) return;
    const qty = parseFloat(amount.replace(",", "."));
    if (!qty || qty <= 0) {
      toast.show("Inserisci una quantità valida", "error");
      return;
    }
    setSaving(true);
    try {
      const delta = mode === "load" ? qty : -qty;
      await api.post(`/materials/${active.id}/adjust`, { delta, reason: mode });
      toast.show(mode === "load" ? "Carico registrato" : "Scarico registrato", "success");
      setSheetOpen(false);
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore aggiornamento", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="bold" size={fontSize["2xl"]}>
          Magazzino
        </AppText>
        <AppText size={fontSize.sm} color={colors.muted} style={{ marginTop: 2 }}>
          {tracked.length} material{tracked.length === 1 ? "e" : "i"} tracciat{tracked.length === 1 ? "o" : "i"}
          {lowCount > 0 ? ` · ${lowCount} sotto scorta` : ""}
        </AppText>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
      ) : (
        <FlatList
          data={tracked}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty} testID="warehouse-empty">
              <View style={styles.emptyIcon}>
                <Ionicons name="cube-outline" size={28} color={colors.brandPrimary} />
              </View>
              <AppText variant="semibold" size={fontSize.lg} style={{ marginTop: spacing.md }}>
                Nessun materiale in magazzino
              </AppText>
              <AppText size={fontSize.base} color={colors.muted} style={styles.emptyText}>
                Attiva «Gestisci giacenza» su un materiale nell'Anagrafica per iniziare a tracciarlo qui.
              </AppText>
              <Button
                title="Vai all'Anagrafica"
                kind="secondary"
                onPress={() => router.push("/(tabs)/library")}
                style={{ marginTop: spacing.lg }}
                testID="warehouse-goto-library"
              />
            </View>
          }
          renderItem={({ item }) => {
            const low = (item.stock ?? 0) <= (item.min_stock ?? 0);
            return (
              <Card style={styles.card} testID={`warehouse-item-${item.id}`}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="semibold" size={fontSize.lg}>
                      {item.name}
                    </AppText>
                    <AppText size={fontSize.sm} color={colors.muted} style={{ marginTop: 2 }}>
                      {item.location || item.manufacturer || "—"}
                    </AppText>
                  </View>
                  {low ? (
                    <View style={styles.lowBadge} testID={`warehouse-low-${item.id}`}>
                      <Ionicons name="alert-circle" size={14} color={colors.error} />
                      <AppText variant="semibold" size={fontSize.sm} color={colors.error}>
                        Sotto scorta
                      </AppText>
                    </View>
                  ) : null}
                </View>

                <View style={styles.stockRow}>
                  <View>
                    <AppText variant="bold" size={fontSize["2xl"]} color={low ? colors.error : colors.brandPrimary}>
                      {item.stock ?? 0}
                      <AppText size={fontSize.base} color={colors.muted}>
                        {" "}
                        {item.unit || ""}
                      </AppText>
                    </AppText>
                    <AppText size={fontSize.sm} color={colors.muted}>
                      Scorta minima: {item.min_stock ?? 0} {item.unit || ""}
                    </AppText>
                  </View>
                  <View style={styles.actions}>
                    <Pressable style={styles.roundBtn} onPress={() => openAdjust(item, "unload")} testID={`unload-${item.id}`}>
                      <Ionicons name="remove" size={22} color={colors.error} />
                    </Pressable>
                    <Pressable style={[styles.roundBtn, styles.roundBtnAdd]} onPress={() => openAdjust(item, "load")} testID={`load-${item.id}`}>
                      <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      <FormSheet
        visible={sheetOpen}
        title={mode === "load" ? "Carico magazzino" : "Scarico magazzino"}
        onClose={() => setSheetOpen(false)}
        footer={<Button title={mode === "load" ? "Registra carico" : "Registra scarico"} onPress={confirmAdjust} loading={saving} testID="confirm-adjust" />}
      >
        {active ? (
          <AppText size={fontSize.base} color={colors.muted} style={{ marginBottom: spacing.md }}>
            {active.name} · Giacenza attuale: {active.stock ?? 0} {active.unit || ""}
          </AppText>
        ) : null}
        <Field
          label={`Quantità da ${mode === "load" ? "caricare" : "scaricare"}${active?.unit ? ` (${active.unit})` : ""}`}
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          keyboardType="decimal-pad"
          testID="adjust-amount-input"
        />
      </FormSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },
  card: { gap: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  lowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  stockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actions: { flexDirection: "row", gap: spacing.sm },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  roundBtnAdd: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  empty: { alignItems: "center", paddingTop: spacing["3xl"] },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { marginTop: spacing.xs, textAlign: "center", paddingHorizontal: spacing.xl },
});
