import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Card, Button } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { FormSheet } from "@/src/components/FormSheet";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { colors, fontSize, spacing, radius } from "@/src/theme";

type Client = { id: string; name: string; clinic: string; address: string; vat: string; email: string; phone: string };
type Material = {
  id: string;
  name: string;
  manufacturer: string;
  ce_number: string;
  lot_default: string;
  category: string;
  track_stock: boolean;
  unit: string;
  stock: number;
  min_stock: number;
  location: string;
};

const emptyClient: Client = { id: "", name: "", clinic: "", address: "", vat: "", email: "", phone: "" };
const emptyMaterial: Material = {
  id: "",
  name: "",
  manufacturer: "",
  ce_number: "",
  lot_default: "",
  category: "",
  track_stock: false,
  unit: "",
  stock: 0,
  min_stock: 0,
  location: "",
};

export default function Library() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [tab, setTab] = useState<"clients" | "materials">("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editClient, setEditClient] = useState<Client>(emptyClient);
  const [editMaterial, setEditMaterial] = useState<Material>(emptyMaterial);

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([api.get<Client[]>("/clients"), api.get<Material[]>("/materials")]);
      setClients(c);
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

  const openNew = () => {
    if (tab === "clients") setEditClient(emptyClient);
    else setEditMaterial(emptyMaterial);
    setSheetOpen(true);
  };

  const openEdit = (item: Client | Material) => {
    if (tab === "clients") setEditClient(item as Client);
    else setEditMaterial(item as Material);
    setSheetOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (tab === "clients") {
        if (!editClient.name.trim()) {
          toast.show("Il nome è obbligatorio", "error");
          setSaving(false);
          return;
        }
        if (editClient.id) await api.put(`/clients/${editClient.id}`, editClient);
        else await api.post("/clients", editClient);
      } else {
        if (!editMaterial.name.trim()) {
          toast.show("Il nome è obbligatorio", "error");
          setSaving(false);
          return;
        }
        if (editMaterial.id) await api.put(`/materials/${editMaterial.id}`, editMaterial);
        else await api.post("/materials", editMaterial);
      }
      setSheetOpen(false);
      toast.show("Salvato", "success");
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore salvataggio", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Client | Material) => {
    try {
      if (tab === "clients") await api.del(`/clients/${item.id}`);
      else await api.del(`/materials/${item.id}`);
      toast.show("Eliminato", "success");
      load();
    } catch {
      toast.show("Errore eliminazione", "error");
    }
  };

  const data = tab === "clients" ? clients : materials;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="bold" size={fontSize["2xl"]} style={styles.headerTitle}>
          Anagrafica
        </AppText>
        <View style={styles.segment}>
          <Pressable
            style={[styles.segBtn, tab === "clients" && styles.segActive]}
            onPress={() => setTab("clients")}
            testID="segment-clients"
          >
            <AppText variant="semibold" size={fontSize.base} color={tab === "clients" ? colors.brandPrimary : colors.muted}>
              Clienti
            </AppText>
          </Pressable>
          <Pressable
            style={[styles.segBtn, tab === "materials" && styles.segActive]}
            onPress={() => setTab("materials")}
            testID="segment-materials"
          >
            <AppText variant="semibold" size={fontSize.base} color={tab === "materials" ? colors.brandPrimary : colors.muted}>
              Materiali
            </AppText>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty} testID="library-empty">
              <View style={styles.emptyIcon}>
                <Ionicons name={tab === "clients" ? "people-outline" : "cube-outline"} size={28} color={colors.brandPrimary} />
              </View>
              <AppText variant="semibold" size={fontSize.lg} style={{ marginTop: spacing.md }}>
                {tab === "clients" ? "Nessun cliente" : "Nessun materiale"}
              </AppText>
              <AppText size={fontSize.base} color={colors.muted} style={styles.emptyText}>
                Aggiungi voci riutilizzabili per compilare le dichiarazioni più velocemente.
              </AppText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => openEdit(item)} testID={`library-item-${item.id}`}>
              <Card style={styles.card}>
                <View style={{ flex: 1 }}>
                  <AppText variant="semibold" size={fontSize.lg}>
                    {item.name}
                  </AppText>
                  {tab === "clients" ? (
                    <AppText size={fontSize.sm} color={colors.muted} style={{ marginTop: 2 }}>
                      {(item as Client).clinic || "—"}
                    </AppText>
                  ) : (
                    <AppText variant="mono" size={fontSize.sm} color={colors.muted} style={{ marginTop: 2 }}>
                      {(item as Material).manufacturer || "—"}
                      {(item as Material).ce_number ? ` · CE ${(item as Material).ce_number}` : ""}
                    </AppText>
                  )}
                </View>
                <Pressable onPress={() => remove(item)} hitSlop={10} testID={`delete-${item.id}`}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </Pressable>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Pressable style={[styles.fab, { bottom: insets.bottom + 80 }]} onPress={openNew} testID="library-add-fab">
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>

      <FormSheet
        visible={sheetOpen}
        title={
          tab === "clients"
            ? editClient.id
              ? "Modifica cliente"
              : "Nuovo cliente"
            : editMaterial.id
            ? "Modifica materiale"
            : "Nuovo materiale"
        }
        onClose={() => setSheetOpen(false)}
        footer={<Button title="Salva" onPress={save} loading={saving} testID="sheet-save-button" />}
      >
        {tab === "clients" ? (
          <>
            <Field label="Nome / Odontoiatra *" value={editClient.name} onChangeText={(t) => setEditClient({ ...editClient, name: t })} placeholder="Dott. Bianchi" testID="client-name-input" />
            <Field label="Studio / Clinica" value={editClient.clinic} onChangeText={(t) => setEditClient({ ...editClient, clinic: t })} placeholder="Studio Dentistico Bianchi" testID="client-clinic-input" />
            <Field label="Indirizzo" value={editClient.address} onChangeText={(t) => setEditClient({ ...editClient, address: t })} placeholder="Via Roma 1, Milano" testID="client-address-input" />
            <Field label="Partita IVA" value={editClient.vat} onChangeText={(t) => setEditClient({ ...editClient, vat: t })} placeholder="IT01234567890" mono autoCapitalize="characters" testID="client-vat-input" />
            <Field label="Email" value={editClient.email} onChangeText={(t) => setEditClient({ ...editClient, email: t })} placeholder="studio@email.it" keyboardType="email-address" autoCapitalize="none" testID="client-email-input" />
            <Field label="Telefono" value={editClient.phone} onChangeText={(t) => setEditClient({ ...editClient, phone: t })} placeholder="+39 02 1234567" keyboardType="phone-pad" testID="client-phone-input" />
          </>
        ) : (
          <>
            <Field label="Nome materiale *" value={editMaterial.name} onChangeText={(t) => setEditMaterial({ ...editMaterial, name: t })} placeholder="Zirconia" testID="material-name-input" />
            <Field label="Produttore" value={editMaterial.manufacturer} onChangeText={(t) => setEditMaterial({ ...editMaterial, manufacturer: t })} placeholder="Ivoclar" testID="material-manufacturer-input" />
            <Field label="Marcatura CE" value={editMaterial.ce_number} onChangeText={(t) => setEditMaterial({ ...editMaterial, ce_number: t })} placeholder="CE 0123" mono autoCapitalize="characters" testID="material-ce-input" />
            <Field label="Lotto predefinito" value={editMaterial.lot_default} onChangeText={(t) => setEditMaterial({ ...editMaterial, lot_default: t })} placeholder="LOT-2026-001" mono autoCapitalize="characters" testID="material-lot-input" />
            <Field label="Categoria" value={editMaterial.category} onChangeText={(t) => setEditMaterial({ ...editMaterial, category: t })} placeholder="Ceramica" testID="material-category-input" />

            <Pressable
              style={styles.trackToggle}
              onPress={() => setEditMaterial({ ...editMaterial, track_stock: !editMaterial.track_stock })}
              testID="material-track-toggle"
            >
              <View style={[styles.checkbox, editMaterial.track_stock && styles.checkboxOn]}>
                {editMaterial.track_stock ? <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="semibold" size={fontSize.base}>
                  Gestisci giacenza (magazzino)
                </AppText>
                <AppText size={fontSize.sm} color={colors.muted}>
                  Traccia la quantità disponibile e la scorta minima
                </AppText>
              </View>
            </Pressable>

            {editMaterial.track_stock ? (
              <>
                <Field label="Unità di misura" value={editMaterial.unit} onChangeText={(t) => setEditMaterial({ ...editMaterial, unit: t })} placeholder="pz, g, ml…" testID="material-unit-input" />
                <Field label="Giacenza attuale" value={String(editMaterial.stock ?? 0)} onChangeText={(t) => setEditMaterial({ ...editMaterial, stock: parseFloat(t.replace(",", ".")) || 0 })} placeholder="0" keyboardType="decimal-pad" testID="material-stock-input" />
                <Field label="Scorta minima" value={String(editMaterial.min_stock ?? 0)} onChangeText={(t) => setEditMaterial({ ...editMaterial, min_stock: parseFloat(t.replace(",", ".")) || 0 })} placeholder="0" keyboardType="decimal-pad" testID="material-minstock-input" />
                <Field label="Ubicazione" value={editMaterial.location} onChangeText={(t) => setEditMaterial({ ...editMaterial, location: t })} placeholder="Es. Scaffale A2" testID="material-location-input" />
              </>
            ) : null}
          </>
        )}
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
  },
  headerTitle: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: 4,
  },
  segBtn: { flex: 1, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  segActive: { backgroundColor: colors.surfaceSecondary },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md },
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
  trackToggle: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, marginTop: spacing.xs },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
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
