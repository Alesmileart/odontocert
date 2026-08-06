import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Card, Button } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { FormSheet } from "@/src/components/FormSheet";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { colors, fontSize, spacing, radius } from "@/src/theme";

type Invoice = {
  id: string;
  number: string;
  date: string;
  total: number;
  client_snapshot: { name?: string; clinic?: string };
  lines: unknown[];
};
type PriceItem = { id: string; name: string; price: number; mode: "flat" | "per_element"; category: string; description: string };

const emptyPrice: PriceItem = { id: "", name: "", price: 0, mode: "flat", category: "", description: "" };

function fmtDate(iso?: string) {
  if (!iso) return "";
  if (iso.includes("/")) return iso;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtEur(n?: number) {
  return "€ " + Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Billing() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"invoices" | "listino">("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<PriceItem>(emptyPrice);

  const load = useCallback(async () => {
    try {
      const [inv, pr] = await Promise.all([api.get<Invoice[]>("/invoices"), api.get<PriceItem[]>("/price-items")]);
      setInvoices(inv);
      setPrices(pr);
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

  const openNewPrice = () => {
    setEdit(emptyPrice);
    setSheetOpen(true);
  };
  const openEditPrice = (p: PriceItem) => {
    setEdit(p);
    setSheetOpen(true);
  };

  const savePrice = async () => {
    if (!edit.name.trim()) {
      toast.show("Inserisci il nome della voce", "error");
      return;
    }
    setSaving(true);
    try {
      const body = { name: edit.name, price: edit.price, mode: edit.mode, category: edit.category, description: edit.description };
      if (edit.id) await api.put(`/price-items/${edit.id}`, body);
      else await api.post("/price-items", body);
      setSheetOpen(false);
      toast.show("Voce salvata", "success");
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore salvataggio", "error");
    } finally {
      setSaving(false);
    }
  };

  const removePrice = async (p: PriceItem) => {
    try {
      await api.del(`/price-items/${p.id}`);
      toast.show("Voce eliminata", "success");
      load();
    } catch {
      toast.show("Errore eliminazione", "error");
    }
  };

  const onFab = () => {
    if (tab === "invoices") router.push("/billing/new");
    else openNewPrice();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} testID="billing-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <AppText variant="semibold" size={fontSize.base}>
            Fatturazione
          </AppText>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.segment}>
          <Pressable style={[styles.segBtn, tab === "invoices" && styles.segActive]} onPress={() => setTab("invoices")} testID="segment-invoices">
            <AppText variant="semibold" size={fontSize.base} color={tab === "invoices" ? colors.brandPrimary : colors.muted}>
              Fatture
            </AppText>
          </Pressable>
          <Pressable style={[styles.segBtn, tab === "listino" && styles.segActive]} onPress={() => setTab("listino")} testID="segment-listino">
            <AppText variant="semibold" size={fontSize.base} color={tab === "listino" ? colors.brandPrimary : colors.muted}>
              Listino
            </AppText>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
      ) : tab === "invoices" ? (
        <FlatList
          data={invoices}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="Nessuna fattura"
              text="Crea la tua prima fattura ai clienti, collegandola opzionalmente alle dichiarazioni."
              testID="invoices-empty"
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/billing/${item.id}`)} testID={`invoice-item-${item.id}`}>
              <Card style={styles.card}>
                <View style={{ flex: 1 }}>
                  <AppText variant="mono" size={fontSize.sm} color={colors.brandPrimary}>
                    {item.number}
                  </AppText>
                  <AppText variant="semibold" size={fontSize.lg} style={{ marginTop: 2 }}>
                    {item.client_snapshot?.name || "Cliente —"}
                  </AppText>
                  <AppText size={fontSize.sm} color={colors.muted} style={{ marginTop: 2 }}>
                    {fmtDate(item.date)} · {(item.lines || []).length} voci
                  </AppText>
                </View>
                <AppText variant="bold" size={fontSize.lg}>
                  {fmtEur(item.total)}
                </AppText>
              </Card>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={prices}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <AppText size={fontSize.sm} color={colors.muted} style={{ marginBottom: spacing.sm }}>
              Voci di listino riutilizzabili nelle fatture. Ogni voce può avere prezzo forfettario o per elemento.
            </AppText>
          }
          ListEmptyComponent={
            <EmptyState
              icon="pricetags-outline"
              title="Listino vuoto"
              text="Aggiungi le tue voci di prezzo per compilare le fatture più velocemente."
              testID="listino-empty"
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => openEditPrice(item)} testID={`price-item-${item.id}`}>
              <Card style={styles.card}>
                <View style={{ flex: 1 }}>
                  <AppText variant="semibold" size={fontSize.lg}>
                    {item.name}
                  </AppText>
                  <AppText size={fontSize.sm} color={colors.muted} style={{ marginTop: 2 }}>
                    {item.mode === "per_element" ? "Per elemento" : "Forfait"}
                    {item.category ? ` · ${item.category}` : ""}
                  </AppText>
                </View>
                <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
                  <AppText variant="bold" size={fontSize.lg}>
                    {fmtEur(item.price)}
                  </AppText>
                  <Pressable onPress={() => removePrice(item)} hitSlop={10} testID={`delete-price-${item.id}`}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Pressable style={[styles.fab, { bottom: insets.bottom + spacing.xl }]} onPress={onFab} testID="billing-add-fab">
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>

      <FormSheet
        visible={sheetOpen}
        title={edit.id ? "Modifica voce listino" : "Nuova voce listino"}
        onClose={() => setSheetOpen(false)}
        footer={<Button title="Salva" onPress={savePrice} loading={saving} testID="price-save-button" />}
      >
        <Field label="Nome voce *" value={edit.name} onChangeText={(t) => setEdit({ ...edit, name: t })} placeholder="Es. Corona in zirconia" testID="price-name-input" />
        <AppText variant="medium" size={fontSize.sm} color={colors.muted} style={styles.miniLabel}>
          TIPO PREZZO
        </AppText>
        <View style={styles.modeRow}>
          <Pressable style={[styles.modeBtn, edit.mode === "flat" && styles.modeBtnActive]} onPress={() => setEdit({ ...edit, mode: "flat" })} testID="price-mode-flat">
            <AppText variant="semibold" size={fontSize.base} color={edit.mode === "flat" ? colors.onBrandPrimary : colors.onSurface}>
              Forfait
            </AppText>
          </Pressable>
          <Pressable style={[styles.modeBtn, edit.mode === "per_element" && styles.modeBtnActive]} onPress={() => setEdit({ ...edit, mode: "per_element" })} testID="price-mode-element">
            <AppText variant="semibold" size={fontSize.base} color={edit.mode === "per_element" ? colors.onBrandPrimary : colors.onSurface}>
              Per elemento
            </AppText>
          </Pressable>
        </View>
        <Field
          label={edit.mode === "per_element" ? "Prezzo per elemento (€)" : "Prezzo forfettario (€)"}
          value={edit.price ? String(edit.price) : ""}
          onChangeText={(t) => setEdit({ ...edit, price: parseFloat(t.replace(",", ".")) || 0 })}
          placeholder="0,00"
          keyboardType="decimal-pad"
          testID="price-value-input"
        />
        <Field label="Categoria" value={edit.category} onChangeText={(t) => setEdit({ ...edit, category: t })} placeholder="Es. Protesi fissa" testID="price-category-input" />
        <Field label="Descrizione" value={edit.description} onChangeText={(t) => setEdit({ ...edit, description: t })} placeholder="Dettagli opzionali" multiline testID="price-description-input" />
        <View style={{ height: spacing.lg }} />
      </FormSheet>
    </View>
  );
}

function EmptyState({ icon, title, text, testID }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; testID?: string }) {
  return (
    <View style={styles.empty} testID={testID}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.brandPrimary} />
      </View>
      <AppText variant="semibold" size={fontSize.lg} style={{ marginTop: spacing.md }}>
        {title}
      </AppText>
      <AppText size={fontSize.base} color={colors.muted} style={styles.emptyText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4 },
  segBtn: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  segActive: { backgroundColor: colors.surfaceSecondary },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  miniLabel: { letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.xs },
  modeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  modeBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  modeBtnActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
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
  fab: {
    position: "absolute",
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});
