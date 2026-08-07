import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { FormSheet } from "@/src/components/FormSheet";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { colors, fontSize, spacing, radius } from "@/src/theme";

type WorkType = { id: string; category: string; subtypes: string[]; order: number };
const empty: WorkType = { id: "", category: "", subtypes: [""], order: 0 };

export default function WorkTypesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<WorkType>(empty);

  const load = useCallback(async () => {
    try {
      const w = await api.get<WorkType[]>("/work-types");
      setItems(w);
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

  const openNew = () => {
    setEdit({ ...empty, subtypes: [""], order: items.length + 1 });
    setSheetOpen(true);
  };
  const openEdit = (w: WorkType) => {
    setEdit({ ...w, subtypes: w.subtypes.length ? [...w.subtypes] : [""] });
    setSheetOpen(true);
  };

  const setSubtype = (i: number, v: string) =>
    setEdit((e) => ({ ...e, subtypes: e.subtypes.map((s, idx) => (idx === i ? v : s)) }));
  const addSubtype = () => setEdit((e) => ({ ...e, subtypes: [...e.subtypes, ""] }));
  const removeSubtype = (i: number) => setEdit((e) => ({ ...e, subtypes: e.subtypes.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!edit.category.trim()) {
      toast.show("Inserisci il nome della categoria", "error");
      return;
    }
    const subtypes = edit.subtypes.map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      const body = { category: edit.category.trim(), subtypes, order: edit.order };
      if (edit.id) await api.put(`/work-types/${edit.id}`, body);
      else await api.post("/work-types", body);
      setSheetOpen(false);
      toast.show("Categoria salvata", "success");
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore salvataggio", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (w: WorkType) => {
    try {
      await api.del(`/work-types/${w.id}`);
      toast.show("Categoria eliminata", "success");
      load();
    } catch {
      toast.show("Errore eliminazione", "error");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} testID="worktypes-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <AppText variant="semibold" size={fontSize.base}>
            Tipi di lavorazione
          </AppText>
          <Pressable onPress={openNew} hitSlop={10} testID="worktypes-add-header">
            <Ionicons name="add" size={26} color={colors.brandPrimary} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <AppText size={fontSize.sm} color={colors.muted} style={{ marginBottom: spacing.md }}>
              Categorie e sottotipi usati nella dichiarazione. Puoi aggiungere, modificare o rimuovere le
              voci: appariranno nei menù a tendina quando crei una lavorazione.
            </AppText>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => openEdit(item)} testID={`worktype-item-${item.id}`}>
              <Card style={styles.card}>
                <View style={styles.cardTop}>
                  <AppText variant="semibold" size={fontSize.lg} style={{ flex: 1 }}>
                    {item.category}
                  </AppText>
                  <Pressable onPress={() => remove(item)} hitSlop={10} testID={`delete-worktype-${item.id}`}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
                <View style={styles.chips}>
                  {item.subtypes.length ? (
                    item.subtypes.map((s, i) => (
                      <View key={i} style={styles.chip}>
                        <AppText size={fontSize.sm} color={colors.onSurfaceSecondary}>
                          {s}
                        </AppText>
                      </View>
                    ))
                  ) : (
                    <AppText size={fontSize.sm} color={colors.muted}>
                      Nessun sottotipo
                    </AppText>
                  )}
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}

      <FormSheet
        visible={sheetOpen}
        title={edit.id ? "Modifica categoria" : "Nuova categoria"}
        onClose={() => setSheetOpen(false)}
        footer={<Button title="Salva" onPress={save} loading={saving} testID="worktype-save-button" />}
      >
        <Field label="Categoria *" value={edit.category} onChangeText={(t) => setEdit({ ...edit, category: t })} placeholder="Es. Protesi Fissa" testID="worktype-category-input" />
        <AppText variant="medium" size={fontSize.sm} color={colors.muted} style={styles.miniLabel}>
          SOTTOTIPI
        </AppText>
        {edit.subtypes.map((s, i) => (
          <Field
            key={i}
            value={s}
            onChangeText={(t) => setSubtype(i, t)}
            placeholder="Es. Corona in Zirconia Monolitica"
            testID={`worktype-subtype-${i}`}
            rightSlot={
              <Pressable onPress={() => removeSubtype(i)} hitSlop={10} testID={`remove-subtype-${i}`}>
                <Ionicons name="close-circle" size={20} color={colors.error} />
              </Pressable>
            }
          />
        ))}
        <Pressable style={styles.addSub} onPress={addSubtype} testID="add-subtype">
          <Ionicons name="add-circle-outline" size={20} color={colors.brandPrimary} />
          <AppText variant="semibold" size={fontSize.base} color={colors.brandPrimary}>
            Aggiungi sottotipo
          </AppText>
        </Pressable>
        <View style={{ height: spacing.lg }} />
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },
  card: { padding: spacing.lg },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  chip: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  miniLabel: { letterSpacing: 0.5, marginBottom: spacing.sm },
  addSub: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm },
});
